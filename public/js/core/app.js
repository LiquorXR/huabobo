import { UI } from '../ui/controller.js';
import { HandTracker } from '../modules/hand-tracker.js';
import { Steamer } from '../modules/steamer.js';
import { API } from '../api/client.js';

export const App = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentMesh: null,
    layers: [],
    activeIndex: 0,
    isSteaming: false,
    isLoading: true,
    modelManifest: null,
    dropShadow: null, // 垂直投影辅助器
    dropLine: null,   // 垂直参考线
    snapshotRenderer: null,
    snapshotCamera: null,
    snapshotScene: null,

    async init() {
        if (typeof THREE === 'undefined') {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        window.API = API; // Expose API globally for inline HTML handlers if needed

        // Initialize core components
        const trackerPromise = HandTracker.init(this);
        
        this.initScene();
        this.initLights();
        this.initObjects();
        
        Steamer.init(this);
        this.animate();

        trackerPromise.then(() => {
            console.debug("App: HandTracker initialized");
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        UI.init(this);
        
        // Show entry login if not authenticated
        if (window.API && !window.API.getToken()) {
            setTimeout(() => UI.showEntryLogin(), 1000);
        }

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // 隐藏加载提示
        this.hideLoading();
    },

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                this.isLoading = false;
            }, 500);
        }
    },

    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.opacity = '1';
            this.isLoading = true;
        }
    },

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);
        
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 18, 28);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true, 
            preserveDrawingBuffer: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.maxPolarAngle = Math.PI / 2.1;
        }
    },

    initLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        
        this.mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.mainLight.position.set(20, 40, 20);
        this.mainLight.castShadow = true;
        
        this.mainLight.shadow.mapSize.width = 2048;
        this.mainLight.shadow.mapSize.height = 2048;
        this.mainLight.shadow.camera.near = 0.5;
        this.mainLight.shadow.camera.far = 150;
        this.mainLight.shadow.camera.left = -30;
        this.mainLight.shadow.camera.right = 30;
        this.mainLight.shadow.camera.top = 30;
        this.mainLight.shadow.camera.bottom = -30;
        this.mainLight.shadow.radius = 6; // Softer shadows
        this.mainLight.shadow.bias = -0.0005; // Reduce shadow acne
        
        // Lock target to scene center
        const lightTarget = new THREE.Object3D();
        this.scene.add(lightTarget);
        this.mainLight.target = lightTarget;
        
        this.scene.add(this.mainLight);

        // Fill Light (Soft light from the opposite side)
        const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.4);
        fillLight.position.set(-15, 10, -10);
        this.scene.add(fillLight);

        // Rim Light (Highlight edges)
        const rimLight = new THREE.PointLight(0xffffff, 0.6);
        rimLight.position.set(0, 10, -20);
        this.scene.add(rimLight);
    },

    initObjects() {
        // Improved board material (wood-like texture appearance)
        const board = new THREE.Mesh(
            new THREE.BoxGeometry(36, 1.5, 28), 
            new THREE.MeshStandardMaterial({ 
                color: 0xe5ba8b, 
                roughness: 0.7, 
                metalness: 0.05 
            })
        );
        board.position.y = -0.75;
        board.receiveShadow = true;
        this.scene.add(board);

        // 初始化垂直投影辅助点
        const shadowGeo = new THREE.CircleGeometry(1.2, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.15,
            depthWrite: false
        });
        this.dropShadow = new THREE.Mesh(shadowGeo, shadowMat);
        this.dropShadow.rotation.x = -Math.PI / 2;
        this.dropShadow.position.y = 0.01; // 略微高于桌面防止闪烁
        this.dropShadow.visible = false;
        this.scene.add(this.dropShadow);

        // 初始化垂直参考线 (虚线感)
        const lineGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
        const lineMat = new THREE.MeshBasicMaterial({ 
            color: 0xfbbf24, 
            transparent: true, 
            opacity: 0.3 
        });
        this.dropLine = new THREE.Mesh(lineGeo, lineMat);
        this.dropLine.visible = false;
        this.scene.add(this.dropLine);
        
        // Load models from DB API
        fetch('/api/resources/models')
            .then(res => res.json())
            .then(data => {
                this.modelManifest = {
                    models: data.map(m => ({
                        id: m.id,
                        name: m.name,
                        file_name: m.file_name,
                        path: `/api/resources/models/${m.id}`,
                        type: 'custom'
                    }))

                };
                // Prepend default primitive
                this.modelManifest.models.unshift({ id: 'default', name: '圆球面团', type: 'primitive' });
                this.addNewLayer('default');
            })
            .catch(() => this.addNewLayer());

    },

    async addNewLayer(modelId = 'default') {
        let mesh;
        let modelData = null;
        if (this.modelManifest && this.modelManifest.models) {
            modelData = this.modelManifest.models.find(m => m.id === modelId);
        }

        if (!modelData || modelData.type === 'primitive') {
            // Default Sphere
            const sphereGeo = new THREE.SphereGeometry(2, 64, 64);
            sphereGeo.translate(0, 2, 0); // 将球体底面平移至原点 (0,0,0)
            
            mesh = new THREE.Mesh(
                sphereGeo, 
                new THREE.MeshStandardMaterial({ 
                    color: 0xffffff, 
                    roughness: 0.6,
                    metalness: 0.02,
                    emissive: 0x222222,
                    emissiveIntensity: 0.1
                })
            );
            mesh.userData.isPrimitive = true;
            mesh.position.set((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5); // 初始落位桌面
        } else {
            // Load External Model
            try {
                this.showLoading(); // Show loading during model load
                mesh = await this.loadExternalModel(modelData);
                mesh.position.set((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5);
                this.hideLoading();
            } catch (e) {
                console.error("Load model failed, fallback to sphere", e);
                this.hideLoading();
                return this.addNewLayer('default');
            }
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const layer = { 
            mesh, 
            modelId,
            thumbnail: await this.captureModelSnapshot(mesh)
        };
        
        this.layers.push(layer);
        this.scene.add(mesh);
        this.selectLayer(this.layers.length - 1);
    },

    exportProjectState() {
        const state = [];
        this.layers.forEach(layer => {
            const mesh = layer.mesh;
            
            // Extract colors safely
            let colorHex = '#ffffff';
            let firstMesh = null;
            mesh.traverse(child => { if (child.isMesh && !firstMesh) firstMesh = child; });
            if (firstMesh && firstMesh.material) {
                if (Array.isArray(firstMesh.material) && firstMesh.material[0].color) {
                    colorHex = '#' + firstMesh.material[0].color.getHexString();
                } else if (firstMesh.material.color) {
                    colorHex = '#' + firstMesh.material.color.getHexString();
                }
            }

            state.push({
                modelId: layer.modelId,
                position: mesh.position.toArray(),
                rotation: mesh.rotation.toArray(),
                scale: mesh.scale.toArray(),
                color: colorHex
            });
        });
        return JSON.stringify(state);
    },

    async loadProjectState(jsonString) {
        try {
            const state = JSON.parse(jsonString);
            
            // Clear current layers
            while(this.layers.length > 0) {
                this.scene.remove(this.layers[0].mesh);
                this.layers.splice(0, 1);
            }
            this.activeIndex = 0;
            this.currentMesh = null;
            UI.updateLayerUI([], 0);
            
            this.showLoading();

            // Rebuild layers from state
            for (let i = 0; i < state.length; i++) {
                const s = state[i];
                let modelData = null;
                if (this.modelManifest && this.modelManifest.models) {
                    modelData = this.modelManifest.models.find(m => m.id === s.modelId);
                }

                let mesh;
                if (!modelData || modelData.type === 'primitive') {
                    const sphereGeo = new THREE.SphereGeometry(2, 64, 64);
                    sphereGeo.translate(0, 2, 0); 
                    mesh = new THREE.Mesh(
                        sphereGeo, 
                        new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.6, metalness: 0.02 })
                    );
                    mesh.userData.isPrimitive = true;
                } else {
                    mesh = await this.loadExternalModel(modelData);
                }
                
                mesh.position.fromArray(s.position);
                mesh.rotation.fromArray(s.rotation);
                mesh.scale.fromArray(s.scale);
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Restoring color
                mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => { if (m.color) m.color.set(s.color); });
                        } else if (child.material.color) {
                            child.material.color.set(s.color);
                        }
                    }
                });
                
                const layer = {
                    mesh,
                    modelId: s.modelId,
                    thumbnail: await this.captureModelSnapshot(mesh)
                };
                
                this.layers.push(layer);
                this.scene.add(mesh);
            }
            
            this.hideLoading();
            if (this.layers.length > 0) {
                this.selectLayer(this.layers.length - 1);
            } else {
                this.addNewLayer();
            }

        } catch(e) {
            console.error("Failed to load project state", e);
            this.hideLoading();
            alert("读取存档失败！");
        }
    },

    loadExternalModel(modelData) {
        return new Promise((resolve, reject) => {
            let path = modelData.path;
            
            // If path is a relative path to static files, we still support it for now
            // but the new models will have full /api/resources/models/:id paths
            if (!path.startsWith('http') && !path.startsWith('/') && !path.startsWith('models/')) {
                path = 'models/' + path;
            }


            const sourceForExt = modelData.file_name || path;
            const extension = sourceForExt.split('.').pop().toLowerCase();

            let loader;
            
            if (extension === 'glb' || extension === 'gltf') {
                if (typeof THREE.GLTFLoader === 'undefined') {
                    reject(new Error("GLTFLoader not loaded"));
                    return;
                }
                loader = new THREE.GLTFLoader();
                if (typeof THREE.DRACOLoader !== 'undefined') {
                    const dracoLoader = new THREE.DRACOLoader();
                    dracoLoader.setDecoderPath('lib/draco/');
                    loader.setDRACOLoader(dracoLoader);
                }
            } else if (extension === 'obj') {
                if (typeof THREE.OBJLoader === 'undefined') {
                    reject(new Error("OBJLoader not loaded"));
                    return;
                }
                loader = new THREE.OBJLoader();
            } else {
                reject(new Error("Unsupported model format: " + extension));
                return;
            }

            loader.load(path, (result) => {
                let object = result.scene || result;
                
                // Standardize: Center and Scale
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                // Scale to fit roughly 4 units wide/high
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 4 / maxDim;
                object.scale.setScalar(scale);
                
                // Offset to center and sit on floor
                object.position.x = -center.x * scale;
                object.position.y = -box.min.y * scale; // Bottom at 0
                object.position.z = -center.z * scale;

                // Create a wrapper to keep the offset logic clean
                const wrapper = new THREE.Group();
                wrapper.add(object);
                
                // Apply a default material to all meshes if none present
                wrapper.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (!child.material || child.material.type === 'MeshBasicMaterial') {
                            child.material = new THREE.MeshStandardMaterial({ 
                                color: 0xffffff, 
                                roughness: 0.6,
                                metalness: 0.02
                            });
                        }
                    }
                });

                resolve(wrapper);
            }, undefined, reject);
        });
    },

    removeLayer(idx) {
        if (this.layers.length <= 1) return; // Keep at least one layer
        const layer = this.layers[idx];
        if (layer) {
            this.scene.remove(layer.mesh);
            this.layers.splice(idx, 1);
            
            // Adjust activeIndex if we removed a layer before it
            if (idx < this.activeIndex) {
                this.activeIndex--;
            }
            
            // Ensure activeIndex is within bounds
            const newIndex = Math.min(this.activeIndex, this.layers.length - 1);
            
            // Force a UI update without calling selectLayer to avoid triggering another deletion
            this.activeIndex = newIndex;
            this.currentMesh = this.layers[newIndex] ? this.layers[newIndex].mesh : null;
            UI.updateLayerUI(this.layers, this.activeIndex);
        }
    },

    selectLayer(idx) {
        if (this.activeIndex === idx && this.layers.length > 1) {
            if (confirm('确定要删除这个面团吗？')) {
                this.removeLayer(idx);
            }
            return;
        }
        this.activeIndex = idx;
        this.currentMesh = this.layers[idx] ? this.layers[idx].mesh : null;
        UI.updateLayerUI(this.layers, this.activeIndex);
    },

    applyPresetColor(hex) {
        if (this.currentMesh) {
            // Find current color to support toggling
            let currentColorHex = 'ffffff';
            let firstMesh = null;
            this.currentMesh.traverse(child => {
                if (child.isMesh && !firstMesh) firstMesh = child;
            });
            if (firstMesh && firstMesh.material) {
                if (Array.isArray(firstMesh.material) && firstMesh.material[0].color) {
                    currentColorHex = '#' + firstMesh.material[0].color.getHexString();
                } else if (firstMesh.material.color) {
                    currentColorHex = '#' + firstMesh.material.color.getHexString();
                }
            }

            const targetHex = hex.toLowerCase();
            const currentHex = currentColorHex.toLowerCase();
            
            // Toggle logic: If clicking the already selected color, revert to white (default)
            const newHex = (currentHex === targetHex) ? '#ffffff' : hex;

            this.currentMesh.traverse(child => {
                if (child.isMesh && child.material) {
                    // Handle arrays of materials or single material
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            if (m.color) m.color.set(newHex);
                        });
                    } else if (child.material.color) {
                        child.material.color.set(newHex);
                    }
                }
            });

            // Update thumbnail after color change
            const layer = this.layers[this.activeIndex];
            if (layer) {
                this.captureModelSnapshot(this.currentMesh).then(dataUrl => {
                    layer.thumbnail = dataUrl;
                    UI.updateLayerUI(this.layers, this.activeIndex);
                });
            }
        }
        UI.updateLayerUI(this.layers, this.activeIndex);
    },

    /**
     * Captures a snapshot of the given mesh/object
     * @param {THREE.Object3D} object 
     * @returns {Promise<string>} Data URL
     */
    async captureModelSnapshot(object, angle = null) {
        if (!this.snapshotRenderer) {
            this.snapshotRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            this.snapshotRenderer.setSize(256, 256);
            this.snapshotScene = new THREE.Scene();
            // 设置淡灰色背景
            this.snapshotScene.background = new THREE.Color(0xf8fafc); 
            this.snapshotCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            
            const ambient = new THREE.AmbientLight(0xffffff, 0.8);
            const directional = new THREE.DirectionalLight(0xffffff, 0.8);
            directional.position.set(5, 5, 5);
            this.snapshotScene.add(ambient, directional);
        }

        const scene = this.snapshotScene;
        const camera = this.snapshotCamera;
        const renderer = this.snapshotRenderer;

        // Clone or use a copy for snapshot-ting to avoid disturbing main scene
        const previewObj = object.clone();
        
        // Reset position for standard view
        previewObj.position.set(0, 0, 0);
        previewObj.rotation.set(0, 0, 0);
        previewObj.scale.setScalar(1);

        // Center and scale to fit
        const box = new THREE.Box3().setFromObject(previewObj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim; // Fit within 3 units
        previewObj.scale.setScalar(scale);
        previewObj.position.sub(center.multiplyScalar(scale));

        scene.add(previewObj);
        
        // Adjust camera based on angle
        if (angle) {
            camera.position.set(...angle.pos);
            camera.lookAt(...angle.lookAt);
        } else {
            camera.position.set(4, 3, 5);
            camera.lookAt(0, 0, 0);
        }
        
        renderer.clear();
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        
        scene.remove(previewObj);
        
        return dataUrl;
    },

    async captureSceneSnapshot() {
        if (this.layers.length === 0) return JSON.stringify([]);
        
        const fullGroup = new THREE.Group();
        this.layers.forEach(l => {
            const clone = l.mesh.clone();
            fullGroup.add(clone);
        });
        
        const angles = [
            { pos: [4, 3, 5], lookAt: [0, 0, 0] }, // 斜 45 度
            { pos: [0, 5, 0], lookAt: [0, 0, 0] }, // 顶视图
            { pos: [5, 0, 0], lookAt: [0, 0, 0] }  // 侧视图
        ];

        const thumbnails = [];
        for (const angle of angles) {
            thumbnails.push(await this.captureModelSnapshot(fullGroup, angle));
        }
        
        return JSON.stringify(thumbnails);
    },



    async exportModel(format) {
        if (this.layers.length === 0) return;
        
        const exportGroup = new THREE.Group();
        this.layers.forEach(l => {
            const clone = l.mesh.clone();
            exportGroup.add(clone);
        });

        if (format === 'bambu') {
            try {
                const { exportTo3MF } = await import('../lib/three-3mf-exporter.js');
                const blob = await exportTo3MF(exportGroup);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `我的花饽饽_${new Date().getTime()}.3mf`;
                link.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error("Export 3MF failed:", err);
                alert("生成 3MF 失败，请尝试使用 STL 导出或检查控制台。");
            } finally {
                UI.hideExportMenu();
            }
            return;
        }

        let data, extension, mimeType;
        if (format === 'obj') {
            const exporter = new THREE.OBJExporter();
            data = exporter.parse(exportGroup);
            extension = 'obj';
            mimeType = 'text/plain';
        } else {
            const exporter = new THREE.STLExporter();
            data = exporter.parse(exportGroup, { binary: true });
            extension = 'stl';
            mimeType = 'application/octet-stream';
        }
        
        this.downloadFile(data, `我的花饽饽_${new Date().getTime()}.${extension}`, mimeType);
        UI.hideExportMenu();
    },

    downloadFile(data, fileName, mimeType) {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Updates the thumbnail of the currently active layer.
     * Throttled to avoid performance issues during continuous gestures.
     */
    updateActiveLayerThumbnail() {
        if (!this.layers[this.activeIndex]) return;
        
        const now = Date.now();
        if (this._lastThumbnailUpdateTime && now - this._lastThumbnailUpdateTime < 500) {
            // Schedule one more update if we are within throttle window
            if (this._thumbnailTimeout) clearTimeout(this._thumbnailTimeout);
            this._thumbnailTimeout = setTimeout(() => this.updateActiveLayerThumbnail(), 500);
            return;
        }

        this._lastThumbnailUpdateTime = now;
        this.captureModelSnapshot(this.currentMesh).then(dataUrl => {
            if (this.layers[this.activeIndex]) {
                this.layers[this.activeIndex].thumbnail = dataUrl;
                UI.updateLayerUI(this.layers, this.activeIndex);
            }
        });
    },

    startSteaming() {
        if (this.isSteaming) return;
        this.isSteaming = true;
        Steamer.start();
    },

    resetApp() {
        location.reload();
    },

    resetCamera() {
        if (this.camera && this.controls) {
            // Target initial position and orientation
            this.camera.position.set(0, 18, 28);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
            
            // Brief visual feedback if needed
            const btn = document.getElementById('reset-view-btn');
            if (btn) {
                btn.classList.add('bg-amber-500/40');
                setTimeout(() => btn.classList.remove('bg-amber-500/40'), 500);
            }
        }
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        Steamer.update();

        // 更新垂直投影位置
        if (this.currentMesh && this.dropShadow) {
            this.dropShadow.visible = true;
            this.dropShadow.position.x = this.currentMesh.position.x;
            this.dropShadow.position.z = this.currentMesh.position.z;
            
            // 根据高度调整影子大小和透明度
            const height = this.currentMesh.position.y;
            const shadowScale = 1 + height * 0.05;
            this.dropShadow.scale.set(shadowScale, shadowScale, 1);
            this.dropShadow.material.opacity = Math.max(0.05, 0.2 - height * 0.01);

            // 更新垂直参考线
            if (height > 0.5) {
                this.dropLine.visible = true;
                this.dropLine.position.set(this.currentMesh.position.x, height / 2, this.currentMesh.position.z);
                this.dropLine.scale.y = height;
            } else {
                this.dropLine.visible = false;
            }
        } else if (this.dropShadow) {
            this.dropShadow.visible = false;
            if (this.dropLine) this.dropLine.visible = false;
        }

        this.renderer.render(this.scene, this.camera);
    }
};
