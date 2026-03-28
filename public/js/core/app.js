import { UI } from '../ui/controller.js';
import { HandTracker } from '../modules/hand-tracker.js';
import { Steamer } from '../modules/steamer.js';

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

    async init() {
        if (typeof THREE === 'undefined') {
            setTimeout(() => this.init(), 500);
            return;
        }

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
        
        // Load manifest then add default layer
        fetch('models/manifest.json')
            .then(res => res.json())
            .then(data => {
                this.modelManifest = data;
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
            mesh = new THREE.Mesh(
                new THREE.SphereGeometry(2, 64, 64), 
                new THREE.MeshStandardMaterial({ 
                    color: 0xffffff, 
                    roughness: 0.6,
                    metalness: 0.02,
                    emissive: 0x222222,
                    emissiveIntensity: 0.1
                })
            );
            mesh.userData.isPrimitive = true;
            mesh.position.set((Math.random() - 0.5) * 5, 2, (Math.random() - 0.5) * 5);
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
        this.layers.push({ mesh, modelId });
        this.scene.add(mesh);
        this.selectLayer(this.layers.length - 1);
    },

    loadExternalModel(modelData) {
        return new Promise((resolve, reject) => {
            // Fix path: if it doesn't start with http or /, make it relative to models/
            let path = modelData.path;
            if (!path.startsWith('http') && !path.startsWith('/') && !path.startsWith('models/')) {
                path = 'models/' + path;
            }

            const extension = path.split('.').pop().toLowerCase();
            let loader;
            
            if (extension === 'glb' || extension === 'gltf') {
                if (typeof THREE.GLTFLoader === 'undefined') {
                    reject(new Error("GLTFLoader not loaded"));
                    return;
                }
                loader = new THREE.GLTFLoader();
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
        }
        UI.updateLayerUI(this.layers, this.activeIndex);
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
                const { exportTo3MF } = await import('https://cdn.jsdelivr.net/npm/three-3mf-exporter/+esm');
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
        this.renderer.render(this.scene, this.camera);
    }
};
