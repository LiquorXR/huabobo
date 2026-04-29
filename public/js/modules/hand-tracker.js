import { UI } from '../ui/controller.js';

const CDN_HANDS = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240';
const CDN_CAMERA = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862';
const CDN_DRAWING = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124';

export const HandTracker = {
    app: null,
    videoElement: null,
    canvasElement: null,
    canvasCtx: null,
    videoElementMobile: null,
    canvasElementMobile: null,
    canvasCtxMobile: null,
    hands: null,
    _camera: null,
    _cameraStream: null,
    _frameTimer: null,
    _enabled: false,
    _loading: false,

    state: {
        history: [],
        maxHistory: 8,
        currentActive: 'none',
        lastTransitionTime: 0,
        transitionCooldown: 350,
        smoothPosition: { x: 0, y: 0, z: 0 },
        smoothScale: { x: 1, y: 1, z: 1 },
        latchTimer: null,
        isDualHandActive: false,
        lockedX: 0,
        lockedZ: 0,
        lastHandCount: 0
    },

    init(appInstance) {
        this.app = appInstance;
        this.videoElement = document.getElementById('input-video');
        this.canvasElement = document.getElementById('output-canvas');
        if (this.canvasElement) this.canvasCtx = this.canvasElement.getContext('2d');

        this.videoElementMobile = document.getElementById('input-video-mobile');
        this.canvasElementMobile = document.getElementById('output-canvas-mobile');
        if (this.canvasElementMobile) this.canvasCtxMobile = this.canvasElementMobile.getContext('2d');
    },

    _setStatus(msg, isError) {
        const hintText = document.getElementById('gesture-hint-text');
        const mobileHintText = document.getElementById('mobile-gesture-hint-text');
        if (hintText) hintText.innerText = msg;
        if (mobileHintText) mobileHintText.innerText = msg;
        if (isError) console.error('HandTracker:', msg);
        else console.log('HandTracker:', msg);
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.defer = true;
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(script);
        });
    },

    async _loadMediaPipeLibs() {
        const origin = window.location.origin;
        const localBase = `${origin}/lib/mediapipe`;

        const scriptFiles = [
            { file: 'hands.js', cdn: CDN_HANDS },
            { file: 'camera_utils.js', cdn: CDN_CAMERA },
            { file: 'drawing_utils.js', cdn: CDN_DRAWING }
        ];

        const loadOne = async ({ file, cdn }) => {
            try {
                await this._loadScript(`${cdn}/${file}`);
                console.log(`HandTracker: Loaded ${file} from CDN`);
            } catch (e) {
                console.warn(`HandTracker: CDN failed for ${file}, falling back to local`, e.message);
                await this._loadScript(`${localBase}/${file}`);
            }
        };

        await Promise.all(scriptFiles.map(loadOne));

        console.log('HandTracker: MediaPipe scripts loaded');
    },

    async enable() {
        if (this._loading) return;
        if (this._enabled) {
            this.disable();
            return;
        }

        this._loading = true;
        this._setStatus('手势模块加载中...');

        try {
            if (!window.Hands || !window.Camera) {
                this._setStatus('加载手势库...');
                await this._loadMediaPipeLibs();
            }

            const isMobile = window.innerWidth < 1024;
            const activeVideo = isMobile && this.videoElementMobile ? this.videoElementMobile : this.videoElement;

            if (!activeVideo) {
                this._setStatus('摄像头元素未找到', true);
                this._loading = false;
                return;
            }

            this._setStatus('启动摄像头...');
            await this._startCamera(activeVideo, isMobile);

            this._setStatus('加载AI模型...');
            await this._initMediaPipe(activeVideo, isMobile);

            this._enabled = true;

            const hintContainer = document.getElementById('gesture-hint');
            if (hintContainer) {
                hintContainer.classList.remove('opacity-0', 'translate-y-2');
                hintContainer.classList.add('opacity-100', 'translate-y-0');
            }
        } catch (e) {
            this._setStatus('手势启动失败: ' + (e.message || '未知错误'), true);
            this._cleanupCamera();
        } finally {
            this._loading = false;
        }
    },

    disable() {
        this._setStatus('手势已关闭');
        this._enabled = false;
        this._cleanupCamera();

        const hintContainer = document.getElementById('gesture-hint');
        if (hintContainer) {
            hintContainer.classList.remove('opacity-100', 'translate-y-0');
            hintContainer.classList.add('opacity-0', 'translate-y-2');
        }

        UI.updateGestureVisuals({});
    },

    _cleanupCamera() {
        if (this._frameTimer) {
            cancelAnimationFrame(this._frameTimer);
            this._frameTimer = null;
        }

        if (this._cameraStream) {
            this._cameraStream.getTracks().forEach(t => t.stop());
            this._cameraStream = null;
        }

        if (this._camera) {
            try { this._camera.stop?.(); } catch (e) {}
            this._camera = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        if (this.videoElementMobile) {
            this.videoElementMobile.srcObject = null;
        }
        if (this.hands) {
            try { this.hands.close?.(); } catch (e) {}
            this.hands = null;
        }
    },

    async _startCamera(videoEl, isMobile) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('摄像头不可用(需要HTTPS或localhost)');
        }

        const width = isMobile ? 480 : 640;
        const height = isMobile ? 360 : 480;

        if (typeof window.Camera !== 'undefined') {
            const camera = new window.Camera(videoEl, {
                onFrame: async () => {
                    if (this.hands) {
                        try { await this.hands.send({ image: videoEl }); } catch (e) {}
                    }
                },
                width,
                height
            });
            await camera.start();
            this._camera = camera;
            console.log('HandTracker: Camera started via MediaPipe helper');
        } else {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width, height, facingMode: 'user' }
            });
            videoEl.srcObject = stream;
            await videoEl.play();
            this._cameraStream = stream;
            console.log('HandTracker: Camera started via native getUserMedia');

            this._startNativeFrameLoop(videoEl);
        }
    },

    _startNativeFrameLoop(videoEl) {
        const sendFrame = async () => {
            if (!this._enabled) return;
            if (this.hands && videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
                try { await this.hands.send({ image: videoEl }); } catch (e) {}
            }
            this._frameTimer = requestAnimationFrame(sendFrame);
        };
        this._frameTimer = requestAnimationFrame(sendFrame);
    },

    async _initMediaPipe(activeVideo, isMobile) {
        const origin = window.location.origin;
        const localAssetPath = `${origin}/lib/mediapipe`;

        const waitForHands = () => {
            if (window.Hands) return Promise.resolve();
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const check = () => {
                    if (window.Hands) resolve();
                    else if (attempts++ < 60) setTimeout(check, 100);
                    else reject(new Error('Hands library load timeout'));
                };
                check();
            });
        };

        await waitForHands();

        let useCDN = false;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const resp = await fetch(`${CDN_HANDS}/hands.binarypb`, {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(timeoutId);
            useCDN = resp.ok;
            console.log('HandTracker: CDN probe ok, will load models from CDN');
        } catch (e) {
            console.warn('HandTracker: CDN unreachable, falling back to local model files', e.message);
        }

        const resolveAsset = useCDN
            ? (file) => `${CDN_HANDS}/${file.split('/').pop()}`
            : (file) => `${localAssetPath}/${file.split('/').pop()}`;

        this.hands = new window.Hands({
            locateFile: (file) => {
                const path = resolveAsset(file);
                console.debug(`HandTracker: Loading asset: ${path}`);
                return path;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.75,
            minTrackingConfidence: 0.75,
            selfieMode: false
        });

        this.hands.onResults((results) => this.onResults(results));

        this._setStatus('手势系统已就绪');
    },

    onResults(results) {
        if (!this._enabled) return;
        const gestures = { move: false, pinch: false, fist: false, scaleUp: false, scaleDown: false };

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

                if (results.multiHandLandmarks) {
                    for (const landmarks of results.multiHandLandmarks) {
                        const connections = window.HAND_CONNECTIONS || (window.Hands && window.Hands.HAND_CONNECTIONS);
                        if (window.drawConnectors && connections) {
                            window.drawConnectors(ctx, landmarks, connections, { color: '#fbbf24', lineWidth: 2 });

                            const tips = [4, 8, 12, 16, 20];
                            const tipConnections = [];
                            for (let i = 0; i < tips.length - 1; i++) {
                                tipConnections.push([tips[i], tips[i+1]]);
                            }
                            window.drawConnectors(ctx, landmarks, tipConnections, { color: 'rgba(251, 191, 36, 0.4)', lineWidth: 1 });

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
                    gesture = 'scaleUp';
                } else if (thumbTip.y > wrist.y && thumbTip.y > lms[17].y + 0.05) {
                    gesture = 'scaleDown';
                } else if (isCurled(8, 5) && isCurled(12, 9) && isCurled(16, 13) && isCurled(20, 17)) {
                    gesture = 'fist';
                } else if (indexTip.y < wrist.y - 0.08) {
                    gesture = 'move';
                }

                handsData.push({ landmarks: lms, palmScale, gesture, indexTip });
            });

            const priorityGesture = handsData.find(h => ['pinch', 'fist', 'scaleUp', 'scaleDown'].includes(h.gesture));
            if (priorityGesture) {
                rawDetected = priorityGesture.gesture;
            } else if (handsData.every(h => h.gesture === 'move')) {
                if (handsData.length === 2) {
                    rawDetected = 'move';
                    const h1 = handsData[0].indexTip, h2 = handsData[1].indexTip;
                    const avgY = (h1.y + h2.y) / 2;

                    if (!this.state.isDualHandActive && this.app.currentMesh) {
                        this.state.isDualHandActive = true;
                        this.state.lockedX = this.app.currentMesh.position.x;
                        this.state.lockedZ = this.app.currentMesh.position.z;
                    }

                    const factorY = 35;
                    const altitude = Math.max(0, (1.1 - avgY - 0.5) * factorY);
                    const finalY = Math.max(0, altitude);

                    targetPos = {
                        x: this.state.lockedX,
                        y: finalY,
                        z: this.state.lockedZ
                    };
                } else if (handsData.length === 1) {
                    this.state.isDualHandActive = false;
                    rawDetected = 'move';
                    const h = handsData[0];
                    const multiplierX = isMobile ? -35 : -30;
                    const multiplierZ = isMobile ? 25 : 22;

                    const currentY = Math.max(0, this.app.currentMesh.position.y);

                    targetPos = {
                        x: (h.indexTip.x - 0.5) * multiplierX,
                        y: currentY,
                        z: (h.indexTip.y - 0.5) * multiplierZ
                    };
                }
            } else {
                this.state.isDualHandActive = false;
            }

            this.state.lastHandCount = handsData.length;
        } else {
            this.state.lastHandCount = 0;
        }

        if (isMobile && rawDetected === 'none' && this.state.currentActive !== 'none') {
            if (!this.state.latchTimer) {
                this.state.latchTimer = setTimeout(() => {
                    this.state.latchTimer = null;
                    this.processFinalGesture('none', null, gestures);
                }, 180);
                return;
            }
            return;
        } else if (this.state.latchTimer) {
            clearTimeout(this.state.latchTimer);
            this.state.latchTimer = null;
        }

        this.processFinalGesture(rawDetected, targetPos, gestures);
    },

    processFinalGesture(rawDetected, targetPos, gestures) {
        this.state.history.push(rawDetected);
        if (this.state.history.length > this.state.maxHistory) this.state.history.shift();

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

        const now = Date.now();
        if (confidentGesture !== this.state.currentActive) {
            const cooldown = confidentGesture === 'none' ? 80 : this.state.transitionCooldown;
            if (now - this.state.lastTransitionTime > cooldown) {
                this.state.currentActive = confidentGesture;
                this.state.lastTransitionTime = now;
            }
        }

        const active = this.state.currentActive;
        if (active !== 'none') {
            gestures[active] = true;

            const isSingleHand = this.state.lastHandCount === 1;
            const smoothFactor = isSingleHand ? 0.25 : 0.18;

            if (active === 'move' && targetPos) {
                let dx = (targetPos.x - this.app.currentMesh.position.x);
                let dy = (targetPos.y - this.app.currentMesh.position.y);
                let dz = (targetPos.z - this.app.currentMesh.position.z);

                const maxDelta = isSingleHand ? 6.0 : 1.2;
                dx = Math.max(-maxDelta, Math.min(maxDelta, dx));
                dy = Math.max(-maxDelta, Math.min(maxDelta, dy));
                dz = Math.max(-maxDelta, Math.min(maxDelta, dz));

                this.app.currentMesh.position.x += dx * smoothFactor;
                this.app.currentMesh.position.y += dy * smoothFactor;
                this.app.currentMesh.position.z += dz * smoothFactor;
            } else if (active === 'pinch') {
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

            if (active !== 'move') {
                this.app.updateActiveLayerThumbnail();
            }
        }

        UI.updateGestureVisuals(gestures);
    }
};
