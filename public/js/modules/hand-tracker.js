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
        lastRawDetected: 'none'
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

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && this.app.currentMesh) {
            let thumbUpCount = 0, thumbDownCount = 0;
            
            results.multiHandLandmarks.forEach((lms) => {
                const wrist = lms[0], thumbTip = lms[4], indexTip = lms[8];
                
                // 1. 动态自适应阈值 (基于手掌尺寸)
                const palmScale = Math.hypot(lms[0].x - lms[9].x, lms[0].y - lms[9].y);
                // Full 模型精度更高，判定阈值可以收紧到 0.4，提高手感
                const adaptivePinchThreshold = palmScale * 0.42; 

                // 2. 角度辅助判定 (针对捏合) - Full 模型下角度判断更加细腻
                const getAngle = (p1, p2, p3) => {
                    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
                    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
                    return Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)));
                };
                const pinchAngle = getAngle(thumbTip, lms[2], indexTip);

                const thumbIsUp = thumbTip.y < lms[2].y && thumbTip.y < indexTip.y;
                const thumbIsDown = thumbTip.y > wrist.y && thumbTip.y > lms[17].y;
                if (thumbIsUp) thumbUpCount++;
                if (thumbIsDown) thumbDownCount++;

                // 支持双手独立操作逻辑
                const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                const isCurled = (tip, mcp) => Math.hypot(lms[tip].x - wrist.x, lms[tip].y - wrist.y) < Math.hypot(lms[mcp].x - wrist.x, lms[mcp].y - wrist.y);
                
                const isPinching = pinchDist < adaptivePinchThreshold && pinchAngle < 0.55;

                // 多手状态优先级判定
                if (isPinching) {
                    rawDetected = 'pinch';
                } else if (isCurled(8, 5) && isCurled(12, 9) && isCurled(16, 13) && isCurled(20, 17)) {
                    rawDetected = 'fist';
                } else if (indexTip.y < wrist.y - 0.08) { 
                    rawDetected = 'move';
                    const multiplierX = isMobile ? -35 : -30;
                    const multiplierZ = isMobile ? 25 : 22;
                    targetPos = { x: (indexTip.x - 0.5) * multiplierX, z: (indexTip.y - 0.5) * multiplierZ };
                }
            });

            if (thumbUpCount >= 1) rawDetected = 'scaleUp';
            else if (thumbDownCount >= 1) rawDetected = 'scaleDown';
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
            
            // 指数加权平滑 (EMA) 提升交互丝滑度
            const smoothFactor = 0.25; 

            if (active === 'move' && targetPos) {
                this.app.currentMesh.position.x += (targetPos.x - this.app.currentMesh.position.x) * smoothFactor;
                this.app.currentMesh.position.z += (targetPos.z - this.app.currentMesh.position.z) * smoothFactor;
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

            // AUTO-ADJUST: Keep bottom on the board surface (y=0)
            // Original radius = 2, so position.y = 2 * scale.y
            const targetY = 2 * this.app.currentMesh.scale.y;
            this.app.currentMesh.position.y += (targetY - this.app.currentMesh.position.y) * 0.2;
        }
        
        UI.updateGestureVisuals(gestures);
    }
};