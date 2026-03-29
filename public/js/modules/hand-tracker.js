import { UI } from '../ui/controller.js';

export const HandTracker = {
    app: null,
    videoElement: null,
    canvasElement: null,
    canvasCtx: null,
    videoElementMobile: null,
    canvasElementMobile: null,
    canvasCtxMobile: null,
    hands: null,

    // Gesture Smoothing & State Management
    state: {
        history: [], // Stores last N frames of raw gesture detection
        maxHistory: 8, // 略微减小窗口，提升移动端响应速度
        currentActive: 'none', // Currently confirmed gesture
        lastTransitionTime: 0,
        transitionCooldown: 350, // 缩短冷却时间，提升交互灵敏度
        smoothPosition: { x: 0, y: 0, z: 0 },
        smoothScale: { x: 1, y: 1, z: 1 },
        latchTimer: null, // 移动端状态保持计时器
        lastRawDetected: 'none',
        isDualHandActive: false, // 是否处于双手指协同模式
        lockedX: 0,
        lockedZ: 0,
        lastHandCount: 0 // 上一次识别到的手数
    },

    async init(appInstance) {
        this.app = appInstance;
        this.videoElement = document.getElementById('input-video');
        this.canvasElement = document.getElementById('output-canvas');
        if (this.canvasElement) this.canvasCtx = this.canvasElement.getContext('2d');

        this.videoElementMobile = document.getElementById('input-video-mobile');
        this.canvasElementMobile = document.getElementById('output-canvas-mobile');
        if (this.canvasElementMobile) this.canvasCtxMobile = this.canvasElementMobile.getContext('2d');
        
        const isMobile = window.innerWidth < 1024;
        const activeVideo = isMobile && this.videoElementMobile ? this.videoElementMobile : this.videoElement;

        if (!activeVideo) {
            console.error('HandTracker: active video element not found');
            return;
        }

        // 优化：先启动摄像头提供反馈，不等待模型加载
        this.startCameraOnly(activeVideo, isMobile);

        // 异步等待库加载并初始化模型
        this.initMediaPipe(activeVideo).catch(err => {
            console.error("HandTracker: MediaPipe async init failed", err);
        });
    },

    async startCameraOnly(videoEl, isMobile) {
        try {
            // 如果 Camera 库还没好，使用原生 API 先跑起来
            if (typeof window.Camera === 'undefined') {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: isMobile ? 480 : 640, height: isMobile ? 360 : 480, facingMode: 'user' } 
                });
                videoEl.srcObject = stream;
                await videoEl.play();
                console.log("HandTracker: Basic video stream started");
            } else {
                const camera = new window.Camera(videoEl, {
                    onFrame: async () => {
                        if (this.hands) {
                            try { await this.hands.send({ image: videoEl }); } catch (e) {}
                        }
                    },
                    width: isMobile ? 480 : 640,
                    height: isMobile ? 360 : 480
                });
                await camera.start();
                console.log("HandTracker: MediaPipe Camera started");
            }
        } catch (e) {
            console.warn("HandTracker: Initial camera start failed", e);
        }
    },

    async initMediaPipe(activeVideo) {
        const isMobile = window.innerWidth < 1024;
        
        const LOCAL_LIB_PATH = 'lib/mediapipe';
        
        const waitForHands = () => {
            if (window.Hands) return Promise.resolve();
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const check = () => {
                    if (window.Hands) resolve();
                    else if (attempts++ < 40) setTimeout(check, 100);
                    else reject(new Error("Hands library load timeout"));
                };
                check();
            });
        };

        try {
            await waitForHands();
            
            this.hands = new window.Hands({
                locateFile: (file) => {
                    // 100% 完全本地化加载所有资源
                    return `${LOCAL_LIB_PATH}/${file}`;
                }
            });

            // 强制启用最高精度 Full 模型 (复杂度 1)
            // 现已成功下载本地 hand_landmark_full.tflite，实现真·高精度运行
            const complexity = 1;
            
            this.hands.setOptions({
                maxNumHands: 2, // 恢复双手检测支持
                modelComplexity: complexity,
                minDetectionConfidence: 0.75, // Full 模型精度更高，调高阈值以消除任何抖动
                minTrackingConfidence: 0.75,
                selfieMode: false // 重要：保持 false。
            });

            this.hands.onResults((results) => this.onResults(results));
            
            console.log('HandTracker: System initialized successfully');
            
            const hintText = document.getElementById('gesture-hint-text');
            const mobileHintText = document.getElementById('mobile-gesture-hint-text');
            if (hintText) hintText.innerText = "手势系统已就绪";
            if (mobileHintText) mobileHintText.innerText = "手势系统已就绪";
        } catch (error) {
            console.error('HandTracker: Initialization failed', error);
            const hintText = document.getElementById('gesture-hint-text');
            const mobileHintText = document.getElementById('mobile-gesture-hint-text');
            const msg = "摄像头启动失败，请检查权限";
            if (hintText) hintText.innerText = msg;
            if (mobileHintText) mobileHintText.innerText = msg;
        }
    },

    onResults(results) {
        const gestures = { move: false, pinch: false, fist: false, scaleUp: false, scaleDown: false };
        
        // Draw skeletons (both desktop and mobile)
        const contexts = [
            { ctx: this.canvasCtx, el: this.canvasElement },
            { ctx: this.canvasCtxMobile, el: this.canvasElementMobile }
        ];

        contexts.forEach(({ ctx, el }) => {
            if (ctx && el && el.offsetParent !== null) {
                if (el.width !== el.clientWidth || el.height !== el.clientHeight) {
                    el.width = el.clientWidth;
                    el.height = el.clientHeight;
                }

                ctx.save();
                ctx.clearRect(0, 0, el.width, el.height);

                // 深度修复：由于 HTML/CSS 中已经对 Canvas 标签应用了 scale-x-[-1] 样式，
                // 画布渲染层本身已经完成了镜像翻转。
                // 如果我们在代码中再次使用 ctx.scale(-1, 1)，骨架就会被“反向翻转”回原始状态，
                // 导致它与已经被镜像翻转的视频流方向正好相反。
                // 因此：此处保持原始坐标系绘制，利用 CSS 镜像来确保双端完美对齐。

                if (results.multiHandLandmarks) {
                    for (const landmarks of results.multiHandLandmarks) {
                        if (window.drawConnectors && window.HAND_CONNECTIONS) {
                            // 1. 标准解剖连接
                            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#fbbf24', lineWidth: 2 });
                            
                            // 2. 增加：指尖闭合连线 (Tip-to-Tip Connections) 增加轮廓感
                            const tips = [4, 8, 12, 16, 20];
                            const tipConnections = [];
                            for (let i = 0; i < tips.length - 1; i++) {
                                tipConnections.push([tips[i], tips[i+1]]);
                            }
                            window.drawConnectors(ctx, landmarks, tipConnections, { color: 'rgba(251, 191, 36, 0.4)', lineWidth: 1 });

                            // 3. 增加：手掌底座闭合 (Palm base)
                            window.drawConnectors(ctx, landmarks, [[0, 1], [0, 5], [0, 17], [5, 9], [9, 13], [13, 17]], { color: 'rgba(251, 191, 36, 0.6)', lineWidth: 1 });
                        }
                        if (window.drawLandmarks) {
                            window.drawLandmarks(ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 1.2 });
                        }
                    }
                }
                ctx.restore();
            }
        });

        if (this.app.isSteaming) {
            UI.updateGestureVisuals(gestures);
            return;
        }

        // 1. Raw detection logic
        let rawDetected = 'none';
        let targetPos = null;

        const isMobile = window.innerWidth < 1024;
        const handsData = [];

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && this.app.currentMesh) {
            results.multiHandLandmarks.forEach((lms, index) => {
                const wrist = lms[0], thumbTip = lms[4], indexTip = lms[8];
                const palmScale = Math.hypot(lms[0].x - lms[9].x, lms[0].y - lms[9].y);
                const adaptivePinchThreshold = palmScale * 0.42; 

                const getAngle = (p1, p2, p3) => {
                    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
                    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
                    return Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)));
                };
                const pinchAngle = getAngle(thumbTip, lms[2], indexTip);
                const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                const isCurled = (tip, mcp) => Math.hypot(lms[tip].x - wrist.x, lms[tip].y - wrist.y) < Math.hypot(lms[mcp].x - wrist.x, lms[mcp].y - wrist.y);

                let gesture = 'none';
                if (pinchDist < adaptivePinchThreshold && pinchAngle < 0.55) {
                    gesture = 'pinch';
                } else if (thumbTip.y < lms[2].y && thumbTip.y < indexTip.y) {
                    // 大拇指显著高于食指及关节点 -> 放大 (优先级高于握拳)
                    gesture = 'scaleUp';
                } else if (thumbTip.y > wrist.y && thumbTip.y > lms[17].y + 0.05) {
                    // 大拇指显著低于手腕和关节点 -> 缩小
                    gesture = 'scaleDown';
                } else if (isCurled(8, 5) && isCurled(12, 9) && isCurled(16, 13) && isCurled(20, 17)) {
                    gesture = 'fist';
                } else if (indexTip.y < wrist.y - 0.08) {
                    // 仅食指上抬 -> 移动
                    gesture = 'move';
                }

                handsData.push({ landmarks: lms, palmScale, gesture, indexTip });
            });

            // 策略判定：
            // 1. 任意手发出了捏合/缩放/握拳，则优先执行（保证单个手操作的灵敏度）
            const priorityGesture = handsData.find(h => ['pinch', 'fist', 'scaleUp', 'scaleDown'].includes(h.gesture));
            if (priorityGesture) {
                rawDetected = priorityGesture.gesture;
            } else if (handsData.every(h => h.gesture === 'move')) {
                // 2. 双手进入 Move 状态时，执行“协同高度控制”
                if (handsData.length === 2) {
                    rawDetected = 'move';
                    const h1 = handsData[0].indexTip, h2 = handsData[1].indexTip;
                    const avgX = (h1.x + h2.x) / 2;
                    const avgY = (h1.y + h2.y) / 2;
                    const avgScale = (handsData[0].palmScale + handsData[1].palmScale) / 2;

                    // 检测并记录双手指抓取瞬间的坐标（用于锁定 X-Z）
                    if (!this.state.isDualHandActive && this.app.currentMesh) {
                        this.state.isDualHandActive = true;
                        this.state.lockedX = this.app.currentMesh.position.x;
                        this.state.lockedZ = this.app.currentMesh.position.z;
                    }

                    const factorY = 35; // 双手抬举更需要线性感

                    // 【核心逻辑】：双手模式下，Screen Y 映射为 World Y (高度)
                    // 锁定 X 和 Z 坐标，仅允许 Y 轴位移
                    const altitude = Math.max(0, (1.1 - avgY - 0.5) * factorY); // 反转 Screen Y
                    
                    // 统一底部边界检测：所有模型（原生与外部）的基准点均已对齐至底部
                    const finalY = Math.max(0, altitude);

                    targetPos = { 
                        x: this.state.lockedX, 
                        y: finalY,
                        z: this.state.lockedZ 
                    };
                } else if (handsData.length === 1) {
                    // 3. 单手模式：退出锁定状态，维持原有的桌面滑动逻辑
                    this.state.isDualHandActive = false;
                    rawDetected = 'move';
                    const h = handsData[0];
                    const multiplierX = isMobile ? -35 : -30;
                    const multiplierZ = isMobile ? 25 : 22;
                    
                    // 【核心改进】：单手控制位移时，高度 (Y) 保持现有高度不变
                    // 仅允许在 X-Z 平面内平移 (且确保不会低于 0)
                    const currentY = Math.max(0, this.app.currentMesh.position.y);
                    
                    targetPos = { 
                        x: (h.indexTip.x - 0.5) * multiplierX, 
                        y: currentY,
                        z: (h.indexTip.y - 0.5) * multiplierZ 
                    };
                }
            } else {
                // 如果没有全在 move 状态，重置双手激活标识
                this.state.isDualHandActive = false;
            }
            
            // 记录当前有效的手数，用于后续平滑切换判定
            this.state.lastHandCount = handsData.length;
        } else {
            this.state.lastHandCount = 0;
        }

        // 3. 状态持久化 (Latching) 解决移动端瞬间丢帧/遮挡导致的闪烁
        if (isMobile && rawDetected === 'none' && this.state.currentActive !== 'none') {
            if (!this.state.latchTimer) {
                this.state.latchTimer = setTimeout(() => {
                    this.state.latchTimer = null;
                    this.processFinalGesture('none', null, gestures);
                }, 180); // 180ms 的状态维持
                return; // 暂不更新状态，等待计时器
            }
            return; // 计时器运行中，维持上一个状态
        } else if (this.state.latchTimer) {
            clearTimeout(this.state.latchTimer);
            this.state.latchTimer = null;
        }

        this.processFinalGesture(rawDetected, targetPos, gestures);
    },

    processFinalGesture(rawDetected, targetPos, gestures) {

        // 2. Smooth logic using history buffer
        this.state.history.push(rawDetected);
        if (this.state.history.length > this.state.maxHistory) this.state.history.shift();

        // 全面提高响应权值
        const confidenceThreshold = 0.75;

        const counts = this.state.history.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        let confidentGesture = 'none';
        for (const [gesture, count] of Object.entries(counts)) {
            if (count >= this.state.maxHistory * confidenceThreshold) {
                confidentGesture = gesture;
                break;
            }
        }

        // 3. State transition with cooldown
        const now = Date.now();
        if (confidentGesture !== this.state.currentActive) {
            const cooldown = confidentGesture === 'none' ? 80 : this.state.transitionCooldown;
            if (now - this.state.lastTransitionTime > cooldown) {
                this.state.currentActive = confidentGesture;
                this.state.lastTransitionTime = now;
            }
        }

        // 4. Apply effects based on confirmed state
        const active = this.state.currentActive;
        if (active !== 'none') {
            gestures[active] = true;
            
            // 动态灵敏度调节：
            // 单手模式恢复高灵敏度 (0.25)，双手抬升保持适中阻尼 (0.18)
            const isSingleHand = this.state.lastHandCount === 1;
            const smoothFactor = isSingleHand ? 0.25 : 0.18; 

            if (active === 'move' && targetPos) {
                // 应用完整的 XYZ 三维位移
                let dx = (targetPos.x - this.app.currentMesh.position.x);
                let dy = (targetPos.y - this.app.currentMesh.position.y);
                let dz = (targetPos.z - this.app.currentMesh.position.z);

                // 缓冲与灵敏度策略：
                // 单手模式放开限制 (maxDelta 为 6.0)，实现极致跟随。
                // 双手模式保持较窄限制，确保抬升过程的绝对垂直与稳定。
                const maxDelta = isSingleHand ? 6.0 : 1.2; 
                dx = Math.max(-maxDelta, Math.min(maxDelta, dx));
                dy = Math.max(-maxDelta, Math.min(maxDelta, dy));
                dz = Math.max(-maxDelta, Math.min(maxDelta, dz));

                this.app.currentMesh.position.x += dx * smoothFactor;
                this.app.currentMesh.position.y += dy * smoothFactor;
                this.app.currentMesh.position.z += dz * smoothFactor;
            } else if (active === 'pinch') {
                // 捏合操作也进行平滑处理，防止瞬间缩放过大
                const targetY = Math.max(0.2, this.app.currentMesh.scale.y - 0.035);
                this.app.currentMesh.scale.y += (targetY - this.app.currentMesh.scale.y) * smoothFactor;
            } else if (active === 'fist') {
                this.app.currentMesh.scale.lerp(new THREE.Vector3(1, 1, 1), smoothFactor);
            } else if (active === 'scaleUp') {
                this.app.currentMesh.scale.addScalar(0.015);
            } else if (active === 'scaleDown') {
                this.app.currentMesh.scale.subScalar(0.015);
                const minScale = 0.2;
                this.app.currentMesh.scale.set(
                    Math.max(minScale, this.app.currentMesh.scale.x),
                    Math.max(minScale, this.app.currentMesh.scale.y),
                    Math.max(minScale, this.app.currentMesh.scale.z)
                );
            }
            
            // Trigger thumbnail update for any active gesture that modifies shape/scale
            if (active !== 'move') {
                this.app.updateActiveLayerThumbnail();
            }
        }

        // AUTO-ADJUST: 移除自动回落逻辑，高度现在具备“粘性” (受用户需求: 高度抬升后固定)
        /* 
        if (active === 'none' && this.app.currentMesh) {
            let targetFloorY = 0;
            if (this.app.currentMesh.userData.isPrimitive) {
                targetFloorY = 2 * this.app.currentMesh.scale.y;
            }
            this.app.currentMesh.position.y += (targetFloorY - this.app.currentMesh.position.y) * 0.15;
        }
        */
        
        UI.updateGestureVisuals(gestures);
    }
};