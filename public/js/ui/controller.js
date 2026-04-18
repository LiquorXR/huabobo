import { API } from '../api/client.js';

export const UI = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
        
        // Global click listener to close dropdowns
        window.addEventListener('click', (e) => {
            const menu = document.getElementById('export-menu-container');
            if (menu && !menu.contains(e.target)) {
                this.hideExportMenu();
            }
        });

        // Setup mobile drawer content on load
        this.setupMobileDrawer();

        // Add touch gestures for mobile drawer
        this.setupDrawerGestures();
        
        // Initial nav update
        this.updateNavAccount();
    },

    updateNavAccount() {
        const user = window.API ? window.API.getUser() : null;
        const textSpan = document.getElementById('nav-account-text');
        if (textSpan) {
            textSpan.innerText = user ? user.username : '登录';
        }
    },

    setupDrawerGestures() {
        const drawer = document.getElementById('mobile-drawer');
        if (!drawer) return;

        let touchStartY = 0;
        let touchMoveY = 0;
        const threshold = 100; // swipe distance required to close

        drawer.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        drawer.addEventListener('touchmove', (e) => {
            touchMoveY = e.touches[0].clientY;
            const deltaY = touchMoveY - touchStartY;

            // Only allow downward swiping
            if (deltaY > 0) {
                // Visual feedback: move drawer slightly with finger
                drawer.style.transform = `translateY(${deltaY}px)`;
                drawer.style.transition = 'none';
            }
        }, { passive: true });

        drawer.addEventListener('touchend', (e) => {
            const deltaY = touchMoveY - touchStartY;
            drawer.style.transform = '';
            drawer.style.transition = '';

            if (deltaY > threshold) {
                // Swipe down enough, close drawer
                this.toggleMobileDrawer();
            }
            
            // Reset values
            touchStartY = 0;
            touchMoveY = 0;
        });
    },

    setupMobileDrawer() {
        const sidebar = document.getElementById('main-sidebar');
        const drawerPlaceholder = document.getElementById('drawer-content-placeholder');
        if (sidebar && drawerPlaceholder) {
            // Clone all sections from sidebar to drawer for mobile view
            const sections = sidebar.querySelectorAll('section');
            sections.forEach((sec, index) => {
                const clone = sec.cloneNode(true);
                clone.classList.remove('pointer-events-auto'); // Reset for drawer flow
                // Add spacing between sections, but not after the last one
                if (index < sections.length - 1) {
                    clone.classList.add('mb-8');
                }
                drawerPlaceholder.appendChild(clone);
            });
        }
    },

    toggleMobileDrawer() {
        const drawer = document.getElementById('mobile-drawer');
        const overlay = document.getElementById('mobile-drawer-overlay');
        if (!drawer || !overlay) return;

        const isHidden = drawer.classList.contains('translate-y-full');
        if (isHidden) {
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                drawer.classList.remove('translate-y-full');
            }, 10);
        } else {
            drawer.classList.add('translate-y-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    },

    toggleMasterDialog() {
        const dialog = document.getElementById('master-dialog');
        const overlay = document.getElementById('master-dialog-overlay');
        if (!dialog || !overlay) return;

        const isHidden = dialog.classList.contains('hidden');
        if (isHidden) {
            overlay.classList.remove('hidden');
            dialog.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                dialog.classList.remove('opacity-0', 'scale-90');
            }, 10);
        } else {
            dialog.classList.add('opacity-0', 'scale-90');
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                dialog.classList.add('hidden');
                overlay.classList.add('hidden');
            }, 300);
        }
    },

    toggleExportMenu() {
        const dropdown = document.getElementById('export-dropdown');
        if (dropdown) dropdown.classList.toggle('show');
    },

    hideExportMenu() {
        const dropdown = document.getElementById('export-dropdown');
        if (dropdown) dropdown.classList.remove('show');
    },

    toggleAccount() {
        const modal = document.getElementById('auth-modal');
        const overlay = document.getElementById('auth-modal-overlay');
        if (!modal || !overlay) return;

        const isHidden = modal.classList.contains('translate-x-full');
        if (isHidden) {
            this.renderAuthContent();
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                modal.classList.remove('translate-x-full');
            }, 10);
        } else {
            modal.classList.add('translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 500);
            this.updateNavAccount();
        }
    },

    renderAuthContent() {
        const container = document.getElementById('auth-modal-content');
        const title = document.getElementById('auth-modal-title');
        const user = window.API ? window.API.getUser() : null;

        if (user) {
            title.innerText = '我的工作台 - ' + user.username;
            container.innerHTML = `
                <div class="flex gap-4 mb-6">
                    <button onclick="UI.saveCurrentProjectAsNew()" class="flex-1 bg-amber-100 text-amber-700 py-3 rounded-xl font-bold hover:bg-amber-200 transition-colors">存为新作品</button>
                    ${this.app && this.app._activeProjectId ? `<button onclick="UI.updateCurrentProject()" class="flex-1 bg-emerald-100 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-200 transition-colors">更新保存</button>` : ''}
                </div>
                
                <h3 class="font-bold text-slate-500 text-sm mb-4">云端存档</h3>
                <div id="user-projects-list" class="space-y-4">
                    <div class="text-center text-slate-400 py-4 text-sm animate-pulse">加载中...</div>
                </div>
                <button onclick="UI.logout()" class="w-full mt-8 py-3 text-red-500 font-bold bg-red-50 rounded-xl hover:bg-red-100 transition-colors">退出登录</button>
            `;
            this.loadUserProjects();
        } else {
            title.innerText = '欢迎回来';
            container.innerHTML = `
                <div class="space-y-4 mt-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">用户名</label>
                        <input id="auth-username" type="text" class="auth-input" placeholder="输入您的昵称">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">密码</label>
                        <input id="auth-password" type="password" class="auth-input" placeholder="输入密码">
                    </div>
                    <div class="pt-4 flex flex-col gap-3">
                        <button onclick="UI.submitLogin()" class="auth-btn">登录 / Login</button>
                        <button onclick="UI.submitRegister()" class="w-full py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">注册新账号</button>
                    </div>
                </div>
            `;
        }
    },

    async loadUserProjects() {
        const list = document.getElementById('user-projects-list');
        if (!list) return;
        try {
            const projects = await window.API.getMyProjects();
            if (projects.length === 0) {
                list.innerHTML = '<div class="text-center text-slate-400 py-6 text-sm">还没有保存过作品</div>';
                return;
            }
            list.innerHTML = projects.map(p => `
                <div class="project-card relative group">
                    ${p.thumbnail ? `<img src="${p.thumbnail}" class="w-full h-32 object-contain bg-slate-50">` : '<div class="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-300">无预览</div>'}
                    <div class="p-3">
                        <h4 class="font-bold text-slate-700">${p.name}</h4>
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-xs text-slate-400">${new Date(p.updatedAt).toLocaleDateString()}</span>
                            ${p.is_public ? '<span class="text-[10px] bg-rose-100 text-rose-500 px-2 py-0.5 rounded-full">已公开发布</span>' : ''}
                        </div>
                    </div>
                    <div class="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                        <button onclick="UI.loadProject('${p.id}')" class="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg" title="加载编辑"><i data-lucide="download" size="18"></i></button>
                        <button onclick="UI.shareProject('${p.id}', ${!p.is_public})" class="p-2 ${p.is_public ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'} text-white rounded-full shadow-lg" title="${p.is_public ? '取消发布' : '发布到社区'}">
                            <i data-lucide="${p.is_public ? 'eye-off' : 'share'}" size="18"></i>
                        </button>
                        <button onclick="UI.deleteProject('${p.id}')" class="p-2 bg-slate-200 text-red-500 rounded-full hover:bg-slate-300" title="删除"><i data-lucide="trash-2" size="18"></i></button>
                    </div>
                </div>
            `).join('');
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            list.innerHTML = '<div class="text-center text-red-400 py-6 text-sm">加载失败</div>';
        }
    },

    async submitLogin() {
        if (!window.API) return;
        const userStr = document.getElementById('auth-username').value;
        const passStr = document.getElementById('auth-password').value;
        if (!userStr || !passStr) return alert("请输入完整的账号密码");
        try {
            await window.API.login(userStr, passStr);
            this.renderAuthContent();
            this.updateNavAccount();
        } catch(e) { alert("登录失败：" + e.message); }
    },

    async submitRegister() {
        if (!window.API) return;
        const userStr = document.getElementById('auth-username').value;
        const passStr = document.getElementById('auth-password').value;
        if (!userStr || !passStr) return alert("请输入完整的账号密码");
        try {
            await window.API.register(userStr, passStr);
            this.renderAuthContent();
            this.updateNavAccount();
        } catch(e) { alert("注册失败：" + e.message); }
    },

    logout() {
        if (window.API) window.API.clearToken();
        if (this.app) this.app._activeProjectId = null;
        this.renderAuthContent();
        this.updateNavAccount();
    },

    async saveCurrentProjectAsNew() {
        if (!this.app || !window.API) return;
        const name = prompt("给你的新作品起个名字吧：", "灵感花饽饽" + Math.floor(Math.random()*100));
        if (!name) return;
        try {
            const data = this.app.exportProjectState();
            let thumbnail = '';
            if (this.app.currentMesh) {
                thumbnail = await this.app.captureModelSnapshot(this.app.currentMesh);
            }
            const res = await window.API.saveProject({ name, scene_data: data, thumbnail });
            this.app._activeProjectId = res.id;
            this.loadUserProjects();
        } catch (e) { alert("保存失败：" + e.message); }
    },

    async updateCurrentProject() {
        if (!this.app || !window.API || !this.app._activeProjectId) return;
        try {
            const data = this.app.exportProjectState();
            let thumbnail = '';
            if (this.app.currentMesh) {
                thumbnail = await this.app.captureModelSnapshot(this.app.currentMesh);
            }
            await window.API.saveProject({ id: this.app._activeProjectId, scene_data: data, thumbnail });
            this.loadUserProjects();
            alert("已更新！");
        } catch (e) { alert("更新失败：" + e.message); }
    },

    async deleteProject(id) {
        if (!confirm("确定要删除这个存档吗？")) return;
        try {
            await window.API.deleteProject(id);
            if (this.app && this.app._activeProjectId === id) this.app._activeProjectId = null;
            this.loadUserProjects();
        } catch(e) { alert("删除失败：" + e.message); }
    },

    async shareProject(id, isPublic) {
        try {
            await window.API.saveProject({ id: id, is_public: isPublic });
            this.loadUserProjects();
        } catch(e) { alert("操作失败：" + e.message); }
    },

    async loadProject(id) {
        try {
            const projects = await window.API.getMyProjects();
            const p = projects.find(x => x.id === id);
            if (p && p.scene_data && this.app) {
                this.app._activeProjectId = p.id;
                await this.app.loadProjectState(p.scene_data);
                this.toggleAccount(); // close panel to see result
            }
        } catch(e) { alert("读取失败：" + e.message); }
    },

    toggleCommunity() {
        const modal = document.getElementById('community-modal');
        if (!modal) return;
        const isHidden = modal.classList.contains('translate-y-full');
        if (isHidden) {
            modal.classList.remove('translate-y-full');
            this.refreshCommunity();
        } else {
            modal.classList.add('translate-y-full');
        }
    },

    async refreshCommunity() {
        const grid = document.getElementById('community-grid');
        if (!grid || !window.API) return;
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400">正在获取最新灵感...</div>';
        try {
            const posts = await window.API.getCommunityPosts(30, 0);
            if (posts.length === 0) {
                grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 text-lg">暂无公开作品，快去分享你的创作吧！</div>';
                return;
            }
            grid.innerHTML = posts.map(p => `
                <div class="waterfall-item">
                    ${p.thumbnail ? `<img src="${p.thumbnail}" class="waterfall-img" loading="lazy">` : '<div class="w-full aspect-[4/3] bg-slate-100"></div>'}
                    <div class="waterfall-footer">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-white font-bold flex items-center justify-center text-[10px] shadow-sm uppercase">${p.author.substring(0,1)}</div>
                            <span class="text-xs font-bold text-slate-600 truncate max-w-[80px]">${p.author}</span>
                        </div>
                        <button onclick="UI.likeCommunityPost('${p.id}', this)" class="like-btn ${p.hasLiked ? 'liked' : ''}">
                            <svg class="like-icon w-5 h-5" viewBox="0 0 24 24" fill="${p.hasLiked ? '#f43f5e' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                            <span class="text-xs like-count">${p.likeCount}</span>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch(e) {
            grid.innerHTML = `<div class="col-span-full py-10 text-center text-red-500">无法连接到社区网络</div>`;
        }
    },

    async likeCommunityPost(id, btnElement) {
        if (!window.API || !window.API.getToken()) {
            alert("请先登录账号才能点赞哦");
            this.toggleCommunity(); // fade out to let user login
            setTimeout(() => this.toggleAccount(), 300);
            return;
        }
        try {
            const res = await window.API.likePost(id);
            const countSpan = btnElement.querySelector('.like-count');
            let count = parseInt(countSpan.innerText);
            
            if (res.liked) {
                btnElement.classList.add('liked');
                btnElement.querySelector('.like-icon').setAttribute('fill', '#f43f5e');
                countSpan.innerText = count + 1;
            } else {
                btnElement.classList.remove('liked');
                btnElement.querySelector('.like-icon').setAttribute('fill', 'none');
                countSpan.innerText = Math.max(0, count - 1);
            }
        } catch(e) { }
    },

    toggleModelDialog() {
        const dialog = document.getElementById('model-dialog');
        const overlay = document.getElementById('model-dialog-overlay');
        if (!dialog || !overlay) return;

        const isHidden = dialog.classList.contains('hidden');
        if (isHidden) {
            overlay.classList.remove('hidden');
            dialog.classList.remove('hidden');
            this.loadModelsToUI();
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                dialog.classList.remove('opacity-0', 'scale-90');
            }, 10);
        } else {
            dialog.classList.add('opacity-0', 'scale-90');
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                dialog.classList.add('hidden');
                overlay.classList.add('hidden');
            }, 300);
        }
    },

    async loadModelsToUI() {
        const grid = document.getElementById('model-grid');
        if (!grid) return;

        try {
            const response = await fetch('models/manifest.json');
            const data = await response.json();
            this.app.modelManifest = data; // Sync back just in case
            
            grid.innerHTML = data.models.map(model => `
                <div id="model-item-${model.id}" onclick="App.addNewLayer('${model.id}'); UI.toggleModelDialog()" 
                     class="group bg-slate-50 hover:bg-amber-50 p-4 rounded-[2rem] border-2 border-transparent hover:border-amber-200 transition-all cursor-pointer flex flex-col items-center gap-3">
                    <div class="thumbnail-container w-full aspect-square bg-[#f8fafc] rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-95 transition-transform overflow-hidden">
                        <div class="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
                    </div>
                    <span class="text-xs font-black text-slate-700 uppercase tracking-widest">${model.name}</span>
                </div>
            `).join('');

            // Background load and capture thumbnails
            for (const model of data.models) {
                this.generateModelPreview(model);
            }
            
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error("Failed to load models manifest", e);
            grid.innerHTML = '<p class="col-span-full text-center py-10 text-slate-400">加载模型清单失败</p>';
        }
    },

    async generateModelPreview(model) {
        const item = document.getElementById(`model-item-${model.id}`);
        if (!item) return;
        const container = item.querySelector('.thumbnail-container');
        
        try {
            let mesh;
            if (model.type === 'primitive') {
                const geo = new THREE.SphereGeometry(2, 32, 32);
                mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
            } else {
                mesh = await this.app.loadExternalModel(model);
            }
            
            const dataUrl = await this.app.captureModelSnapshot(mesh);
            container.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-contain p-2">`;
            
            // Cleanup temporary mesh if it was specifically for preview
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
                else mesh.material.dispose();
            }
        } catch (e) {
            console.error(`Failed to generate preview for ${model.id}`, e);
            container.innerHTML = '<i data-lucide="box" class="text-slate-300" size="32"></i>';
            if (window.lucide) window.lucide.createIcons({ root: container });
        }
    },

    updateLayerUI(layers, activeIndex) {
        // Find all layer lists (sidebar and mobile drawer)
        const lists = document.querySelectorAll('[id="layer-list"]');
        if (lists.length === 0) return;

        let html = layers.map((l, i) => {
            const thumb = l.thumbnail || '';
            const colorHex = l.mesh.material ? '#' + l.mesh.material.color.getHexString() : '#ffffff';

            return `
                <div onclick="App.selectLayer(${i})" 
                     class="group relative flex-none w-14 h-14 rounded-2xl border-2 transition-all cursor-pointer ${i === activeIndex ? 'border-amber-500 bg-amber-50 scale-105 shadow-xl shadow-amber-500/20' : 'border-slate-100/50 hover:border-amber-200 bg-white/50 backdrop-blur-md'}" 
                     style="padding: 2px;">
                    <div class="w-full h-full rounded-xl overflow-hidden relative bg-[#f8fafc]">
                        ${thumb ? `<img src="${thumb}" class="w-full h-full object-contain p-1 z-10 relative">` : ''}
                        <!-- Color Background Hint -->
                        <div class="absolute inset-0 opacity-10" style="background: ${colorHex}"></div>
                    </div>
                    ${i === activeIndex ? `
                        <div class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white z-20">
                            <i data-lucide="check" size="10" stroke-width="4"></i>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Add Add Button - Now opens Model Selection Dialog
        html += `
            <div onclick="UI.toggleModelDialog()" 
                 class="flex-none w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer flex items-center justify-center text-slate-400 hover:text-amber-600">
                <i data-lucide="plus" size="20"></i>
            </div>
        `;

        lists.forEach(list => list.innerHTML = html);
        if (window.lucide) window.lucide.createIcons();
        
        this.updateColorPaletteUI(layers, activeIndex);
    },

    updateColorPaletteUI(layers, activeIndex) {
        let activeColorHex = null;
        if (layers && layers.length > 0 && activeIndex >= 0 && layers[activeIndex]) {
            const mesh = layers[activeIndex].mesh;
            let firstMesh = null;
            mesh.traverse(child => {
                if (child.isMesh && !firstMesh) firstMesh = child;
            });
            if (firstMesh && firstMesh.material) {
                if (Array.isArray(firstMesh.material) && firstMesh.material[0].color) {
                    activeColorHex = '#' + firstMesh.material[0].color.getHexString();
                } else if (firstMesh.material.color) {
                    activeColorHex = '#' + firstMesh.material.color.getHexString();
                }
            }
        }

        if (activeColorHex) activeColorHex = activeColorHex.toLowerCase();

        const buttons = document.querySelectorAll('button.color-card');
        buttons.forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick');
            if (!onclickAttr) return;
            const match = onclickAttr.match(/App\.applyPresetColor\('([^']+)'\)/);
            if (match && match[1]) {
                const btnColor = match[1].toLowerCase();
                const colorDiv = btn.querySelector('div.w-8.h-8');
                if (activeColorHex === btnColor) {
                    btn.classList.remove('border-transparent');
                    btn.classList.add('border-amber-500', 'scale-[1.05]', 'shadow-md', 'bg-white/80');
                    if (colorDiv && !colorDiv.querySelector('.check-icon')) {
                        colorDiv.innerHTML = '<i data-lucide="check" class="check-icon text-white w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"></i>';
                        colorDiv.classList.add('relative');
                        if (window.lucide) window.lucide.createIcons({ root: colorDiv });
                    }
                } else {
                    btn.classList.add('border-transparent');
                    btn.classList.remove('border-amber-500', 'scale-[1.05]', 'shadow-md', 'bg-white/80');
                    if (colorDiv) {
                        colorDiv.innerHTML = '';
                        colorDiv.classList.remove('relative');
                    }
                }
            }
        });
    },

    setThinking(isThinking) {
        const container = document.getElementById('assistant-container');
        const dots = document.getElementById('master-thinking-dots');
        const content = document.getElementById('master-speech-content');

        if (isThinking) {
            if (container) container.classList.add('is-thinking');
            if (dots) dots.classList.remove('hidden');
            if (content) content.innerText = "师傅正在审视作品，请稍候...";
        } else {
            if (container) container.classList.remove('is-thinking');
            if (dots) dots.classList.add('hidden');
        }
    },

    updateSpeech(text) {
        const content = document.getElementById('master-speech-content');
        if (!content) return;

        // Ensure dialog is open when speech comes in
        const dialog = document.getElementById('master-dialog');
        if (dialog && dialog.classList.contains('hidden')) {
            this.toggleMasterDialog();
        }

        // Typewriter Effect
        content.innerText = '';
        let i = 0;
        const speed = 40; // ms per char
        
        const type = () => {
            if (i < text.length) {
                content.innerText += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        };
        type();
    },

    showGameOver() {
        const panel = document.getElementById('game-over-panel');
        if (panel) {
            panel.classList.remove('hidden');
            // Ensure no other blur persists on the main content
            const steamLabel = document.getElementById('steam-label');
            if (steamLabel) steamLabel.classList.add('hidden');

            // Force hide mobile drawer and its overlay which might cause blur
            const drawer = document.getElementById('mobile-drawer');
            const overlay = document.getElementById('mobile-drawer-overlay');
            const masterOverlay = document.getElementById('master-dialog-overlay');
            const masterDialog = document.getElementById('master-dialog');

            if (drawer) drawer.classList.add('translate-y-full');
            if (overlay) {
                overlay.classList.add('opacity-0', 'hidden');
                overlay.classList.remove('backdrop-blur-sm', 'backdrop-blur-md');
            }
            if (masterOverlay) {
                masterOverlay.classList.add('opacity-0', 'hidden');
                masterOverlay.classList.remove('backdrop-blur-md');
            }
            if (masterDialog) {
                masterDialog.classList.add('opacity-0', 'hidden', 'scale-90');
            }

            // Remove any global blur classes if they exist on body or main containers
            document.body.style.overflow = 'auto'; // Re-enable scroll if needed, though we usually keep it hidden
        }
    },

    toggleSteamLabel(show) {
        const label = document.getElementById('steam-label');
        if (label) {
            if (show) label.classList.remove('hidden');
            else label.classList.add('hidden');
        }
    },

    updateGestureVisuals(gestures) {
        const activeGestureKey = Object.keys(gestures).find(key => gestures[key]);

        // Main Gesture Hint Elements
        const hintContainer = document.getElementById('gesture-hint');
        const hintText = document.getElementById('gesture-hint-text');
        
        // Mobile Gesture Hint Elements
        const mobileHintContainer = document.getElementById('mobile-gesture-hint');
        const mobileHintText = document.getElementById('mobile-gesture-hint-text');

        if (activeGestureKey) {
            const config = {
                move: { name: '空间移动', hint: '移动：拖动捏合的手指来移动组件' },
                pinch: { name: '捏制造型', hint: '捏合：调整组件细节形状' },
                fist: { name: '揉圆复原', hint: '握拳：将选中的组件重置为球体' },
                scaleUp: { name: '等比放大', hint: '放大：张开双掌远离来放大' },
                scaleDown: { name: '等比缩小', hint: '缩小：并拢双掌靠近来缩小' }
            };

            const info = config[activeGestureKey];
            
            // Update Gesture Hint UI
            if (hintContainer && hintText) {
                hintText.innerText = info.hint;
                hintContainer.classList.remove('opacity-0', 'translate-y-2');
                hintContainer.classList.add('opacity-100', 'translate-y-0');
            }

            if (mobileHintContainer && mobileHintText) {
                mobileHintText.innerText = info.name;
                mobileHintContainer.classList.remove('opacity-0');
                mobileHintContainer.classList.add('opacity-100');
            }
        } else {
            // PC端无手势时显示"正在识别手势"
            if (hintContainer && hintText) {
                hintText.innerText = "正在识别手势";
                hintContainer.classList.remove('opacity-0', 'translate-y-2');
                hintContainer.classList.add('opacity-100', 'translate-y-0');
            }

            // Mobile Hint: Show "正在识别手势" when no gesture active
            if (mobileHintContainer && mobileHintText) {
                mobileHintText.innerText = "正在识别手势";
                mobileHintContainer.classList.remove('opacity-0');
                mobileHintContainer.classList.add('opacity-100');
            }
        }
    }
};
