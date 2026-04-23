import { API } from '../api/client.js';

export const UI = {
    app: null,
    currentView: 'diy',
    
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
        this.renderCommunityHome();

        if (window.API && window.API.getToken()) {
            this.showCommunityHome(false);
        }
    },

    updateNavAccount() {
        const user = window.API ? window.API.getUser() : null;
        const textSpan = document.getElementById('nav-account-text');
        const btn = document.getElementById('nav-account-btn');
        const communityButtonLabel = document.getElementById('community-nav-label');
        const exportMenu = document.getElementById('export-menu-container');
        const communityBtn = document.getElementById('community-nav-btn');
        const topHeader = document.getElementById('top-header');
        const studioAtmosphere = document.getElementById('studio-atmosphere');
        if (textSpan) {
            textSpan.innerText = user ? (user.role === 'admin' ? '管理员' : user.username) : '登录';
            if (user && user.role === 'admin' && btn) {
                btn.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
            } else if (btn) {
                btn.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
            }
        }

        if (communityButtonLabel) {
            communityButtonLabel.innerText = this.currentView === 'community' ? '返回DIY' : '灵感社区';
        }

        if (exportMenu) {
            exportMenu.classList.toggle('hidden', this.currentView === 'community');
        }

        if (communityBtn) {
            communityBtn.classList.toggle('bg-rose-500', this.currentView === 'community');
            communityBtn.classList.toggle('text-white', this.currentView === 'community');
            communityBtn.classList.toggle('border-rose-400', this.currentView === 'community');
            communityBtn.classList.toggle('shadow-rose-500/20', this.currentView === 'community');
            communityBtn.classList.toggle('bg-white/70', this.currentView !== 'community');
            communityBtn.classList.toggle('text-rose-500', this.currentView !== 'community');
            communityBtn.classList.toggle('border-white/50', this.currentView !== 'community');
        }

        if (topHeader) {
            topHeader.classList.toggle('opacity-95', this.currentView === 'community');
            topHeader.classList.toggle('translate-y-1', this.currentView === 'community');
        }

        if (studioAtmosphere) {
            studioAtmosphere.style.opacity = this.currentView === 'community' ? '0.35' : '1';
        }

        this.renderCommunityHomeProfile();
    },

    showEntryLogin() {
        const overlay = document.getElementById('entry-login-overlay');
        if (!overlay) return;
        
        const card = document.getElementById('entry-login-card');
        if (card) card.classList.remove('active');
        
        // 响应式背景逻辑：移动端使用 2.png，桌面端使用 1.png
        const isMobile = window.innerWidth < 768;
        const photoName = isMobile ? '2.png' : '1.jpg';
        const randomPhoto = `backgrounds/${photoName}`;
        
        overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.1)), url('${randomPhoto}')`;
        overlay.style.backgroundSize = "cover";
        overlay.style.backgroundPosition = "center";
        
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.add('opacity-100');
            if (card) card.classList.add('active');
            if (window.lucide) window.lucide.createIcons();
        }, 10);
    },


    hideEntryLogin() {
        const overlay = document.getElementById('entry-login-overlay');
        const card = document.getElementById('entry-login-card');
        if (!overlay) return;
        if (card) card.classList.remove('active');
        overlay.classList.remove('opacity-100');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 700);
    },

    _entryTab: 'login',
    setEntryTab(tab) {
        this._entryTab = tab;
        const loginTab = document.getElementById('tab-login');
        const registerTab = document.getElementById('tab-register');
        const submitBtn = document.getElementById('entry-submit-btn');

        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            submitBtn.innerText = '开启艺术之旅';
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            submitBtn.innerText = '加入数字传承';
        }
    },

    async submitEntryAuth() {
        const userStr = document.getElementById('entry-username').value;
        const passStr = document.getElementById('entry-password').value;
        if (!userStr || !passStr) return alert("请输入完整的账号密码");

        try {
            if (this._entryTab === 'login') {
                await window.API.login(userStr, passStr);
            } else {
                await window.API.register(userStr, passStr);
            }
            this.hideEntryLogin();
            this.updateNavAccount();
            this.renderAuthContent();
            this.showCommunityHome();
        } catch(e) {
            alert((this._entryTab === 'login' ? "登录" : "注册") + "失败：" + e.message);
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
            title.innerText = '创作管理';
            container.innerHTML = `
                <div class="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Workspace</p>
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h3 class="text-xl font-black text-slate-900">${user.username}</h3>
                            <p class="text-sm text-slate-500 mt-1">在这里管理当前创作、存档和发布状态。</p>
                        </div>
                        <button onclick="UI.changeUsername()" class="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all shrink-0">
                            <i data-lucide="edit-3" size="18"></i>
                        </button>
                    </div>
                </div>

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
            title.innerText = '账号登录';
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
        const lists = [
            document.getElementById('user-projects-list'),
            document.getElementById('community-user-projects-list')
        ].filter(Boolean);
        if (lists.length === 0) return;

        const setListsContent = (html) => {
            lists.forEach(list => {
                list.innerHTML = html;
            });
        };

        try {
            const projects = await window.API.getMyProjects();
            const html = projects.map(p => {
                let thumbs = [];
                try {
                    thumbs = JSON.parse(p.thumbnail);
                    if (!Array.isArray(thumbs)) thumbs = [p.thumbnail];
                } catch(e) {
                    thumbs = p.thumbnail ? [p.thumbnail] : [];
                }

                return `
                <div class="project-card relative group bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-xl" id="project-card-${p.id}">
                    <!-- Image Container with Arrows -->
                    <div class="relative w-full h-40 bg-[#f8fafc] flex items-center justify-center overflow-hidden">
                        ${thumbs.length > 0 ? `
                            <img id="project-thumb-img-${p.id}" src="${thumbs[0]}" data-index="0" data-thumbs='${JSON.stringify(thumbs.filter(Boolean))}' class="w-full h-full object-contain transition-all duration-500">
                            ${thumbs.length > 1 ? `
                                <!-- Arrows -->
                                <button onclick="UI.prevThumbnail('${p.id}', event, 'project')" class="absolute left-1.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm z-20">
                                    <i data-lucide="chevron-left" size="8"></i>
                                </button>
                                <button onclick="UI.nextThumbnail('${p.id}', event, 'project')" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm z-20">
                                    <i data-lucide="chevron-right" size="8"></i>
                                </button>
                                <!-- Indicators -->

                                <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                    ${thumbs.map((_, idx) => `
                                        <div class="thumb-dot w-1.5 h-1.5 rounded-full bg-slate-300 transition-all ${idx === 0 ? 'bg-amber-500 scale-125' : ''}"></div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        ` : '<div class="text-slate-300">无预览</div>'}
                        
                        <!-- Top-Right Menu Button -->
                        <div class="absolute top-2 right-2 z-30">
                            <button onclick="UI.toggleProjectMenu('${p.id}', event)" class="w-5 h-5 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 shadow-sm hover:bg-white transition-all">
                                <i data-lucide="more-vertical" size="8"></i>
                            </button>
                            <!-- Dropdown Menu -->
                            <div id="project-menu-${p.id}" class="hidden absolute right-0 mt-1 w-24 bg-white rounded-md shadow-2xl border border-slate-100 py-1 animate-in fade-in zoom-in duration-200">
                                <button onclick="UI.loadProject('${p.id}')" class="w-full px-2 py-1 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1"><i data-lucide="edit-3" size="6"></i> 编辑作品</button>
                                <button onclick="UI.shareProject('${p.id}', ${!p.is_public})" class="w-full px-2 py-1 text-left text-[10px] font-bold ${p.is_public ? 'text-amber-600' : 'text-emerald-600'} hover:bg-slate-50 flex items-center gap-1">
                                    <i data-lucide="${p.is_public ? 'eye-off' : 'share'}" size="6"></i> ${p.is_public ? '取消发布' : '发布社区'}
                                </button>
                                <div class="h-px bg-slate-100 my-0.5"></div>
                                <button onclick="UI.deleteProject('${p.id}')" class="w-full px-2 py-1 text-left text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-1"><i data-lucide="trash-2" size="6"></i> 删除记录</button>
                            </div>
                        </div>

                    </div>
                    <div class="p-2 bg-white">
                        <h4 class="text-xs font-bold text-slate-800 truncate">${p.name}</h4>
                        <div class="flex justify-between items-center mt-0.5">
                            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">${new Date(p.updatedAt).toLocaleDateString()}</span>
                            ${p.is_public ? '<span class="px-1 py-0.5 bg-rose-50 text-rose-500 text-[7px] font-black rounded-full uppercase tracking-tighter">Live</span>' : ''}
                        </div>
                    </div>


                </div>
                `;
            }).join('');

            setListsContent(html);

            if (projects.length === 0) {
                setListsContent('<div class="text-center text-slate-400 py-10 text-xs font-medium">还没有保存过作品，快去开启第一屉吧！</div>');
            }

            if (window.lucide) window.lucide.createIcons();



        } catch (e) {
            setListsContent('<div class="text-center text-red-400 py-6 text-sm">加载失败</div>');
        }
    },

    switchThumbnail(projectId, src, index, event, scope = 'project') {
        if (event) event.stopPropagation();
        const prefix = scope === 'community' ? 'community-thumb-img' : 'project-thumb-img';
        const cardPrefix = scope === 'community' ? 'community-card' : 'project-card';
        const img = document.getElementById(`${prefix}-${projectId}`);
        if (img) {
            img.src = src;
            img.dataset.index = index;
        }

        // Update dots
        const card = document.getElementById(`${cardPrefix}-${projectId}`);
        if (card) {
            const dots = card.querySelectorAll('.thumb-dot');
            dots.forEach((dot, i) => {
                if (i === index) {
                    dot.classList.add('bg-amber-500', 'scale-125');
                    dot.classList.remove('bg-slate-300');
                } else {
                    dot.classList.remove('bg-amber-500', 'scale-125');
                    dot.classList.add('bg-slate-300');
                }
            });
        }
    },

    nextThumbnail(projectId, event, scope = 'project') {
        if (event) event.stopPropagation();
        const prefix = scope === 'community' ? 'community-thumb-img' : 'project-thumb-img';
        const img = document.getElementById(`${prefix}-${projectId}`);
        if (!img || !img.dataset.thumbs) return;
        const thumbs = JSON.parse(img.dataset.thumbs).filter(Boolean);
        if (thumbs.length === 0) return;
        let idx = parseInt(img.dataset.index || 0);
        idx = (idx + 1) % thumbs.length;
        this.switchThumbnail(projectId, thumbs[idx], idx, event, scope);
    },

    prevThumbnail(projectId, event, scope = 'project') {
        if (event) event.stopPropagation();
        const prefix = scope === 'community' ? 'community-thumb-img' : 'project-thumb-img';
        const img = document.getElementById(`${prefix}-${projectId}`);
        if (!img || !img.dataset.thumbs) return;
        const thumbs = JSON.parse(img.dataset.thumbs).filter(Boolean);
        if (thumbs.length === 0) return;
        let idx = parseInt(img.dataset.index || 0);
        idx = (idx - 1 + thumbs.length) % thumbs.length;
        this.switchThumbnail(projectId, thumbs[idx], idx, event, scope);
    },

    toggleProjectMenu(projectId, event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById(`project-menu-${projectId}`);
        if (!menu) return;
        
        // Close other menus first
        document.querySelectorAll('[id^="project-menu-"]').forEach(m => {
            if (m.id !== `project-menu-${projectId}`) m.classList.add('hidden');
        });

        menu.classList.toggle('hidden');
        
        // Close on outside click
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !event.target.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    },

    touchStartX: 0,
    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
    },
    handleTouchEnd(e, projectId, scope = 'project') {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - this.touchStartX;
        if (Math.abs(diff) > 50) { // Threshold
            if (diff > 0) this.prevThumbnail(projectId, null, scope);
            else this.nextThumbnail(projectId, null, scope);
        }
    },

    getUserProfileCardMarkup(user) {
        if (!user) {
            return `
                <section class="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white shadow-xl p-6">
                    <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Welcome</p>
                    <h3 class="text-2xl font-black text-slate-900">请先登录</h3>
                    <p class="text-sm text-slate-500 mt-2">登录后可查看个人资料、管理作品并进入 DIY 创作。</p>
                </section>
            `;
        }

        return `
            <section class="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white shadow-xl overflow-hidden">
                ${user.role === 'admin' ? `
                <div class="mx-5 mt-5 mb-0 p-4 bg-slate-900 text-white rounded-2xl flex flex-col gap-3 shadow-xl">
                    <div class="flex items-center gap-2 text-amber-400">
                        <i data-lucide="shield-check" size="18"></i>
                        <span class="font-black text-sm uppercase tracking-widest">系统管理员</span>
                    </div>
                    <a href="/admin.html" class="w-full py-2 bg-amber-500 text-center text-amber-950 rounded-xl font-bold text-sm hover:bg-amber-400 transition-all">进入管理后台</a>
                </div>
                ` : ''}
                <div class="p-5 lg:p-6 border-b border-slate-100">
                    <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Profile</p>
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg uppercase shrink-0">
                            ${user.username.substring(0,1)}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">我的艺名</p>
                            <h4 class="font-black text-slate-800 text-xl truncate">${user.username}</h4>
                        </div>
                        <button onclick="UI.changeUsername()" class="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all shrink-0">
                            <i data-lucide="edit-3" size="18"></i>
                        </button>
                    </div>
                </div>
                <div class="p-5 lg:p-6 flex flex-col gap-3">
                    <button onclick="UI.showDIYView()" class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm tracking-widest shadow-lg shadow-orange-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="wand-sparkles" size="18"></i>
                        进入DIY体验
                    </button>
                    <button onclick="UI.logout()" class="w-full py-3 text-red-500 font-bold bg-red-50 rounded-2xl hover:bg-red-100 transition-colors">退出登录</button>
                </div>
            </section>
        `;
    },

    renderCommunityHomeProfile() {
        const container = document.getElementById('community-home-profile');
        if (!container) return;
        const user = window.API ? window.API.getUser() : null;
        container.innerHTML = this.getUserProfileCardMarkup(user);
        if (window.lucide) window.lucide.createIcons({ root: container });
    },

    renderCommunityHome() {
        this.renderCommunityHomeProfile();
        if (window.API && window.API.getToken()) {
            this.loadUserProjects();
            this.refreshCommunity();
        }
    },

    refreshCommunityHome() {
        this.renderCommunityHome();
    },

    showCommunityHome(refresh = true) {
        const modal = document.getElementById('community-modal');
        if (!modal) return;
        this.currentView = 'community';
        modal.classList.remove('translate-y-full');
        this.hideExportMenu();
        this.updateNavAccount();
        if (refresh) {
            this.renderCommunityHome();
        }
    },

    showDIYView() {
        const modal = document.getElementById('community-modal');
        if (!modal) return;
        this.currentView = 'diy';
        modal.classList.add('translate-y-full');
        this.updateNavAccount();
        if (window.innerWidth < 1024) {
            const drawer = document.getElementById('mobile-drawer');
            const overlay = document.getElementById('mobile-drawer-overlay');
            if (drawer) drawer.classList.add('translate-y-full');
            if (overlay) {
                overlay.classList.add('opacity-0');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            }
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
            this.showCommunityHome();
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
            this.showCommunityHome();
        } catch(e) { alert("注册失败：" + e.message); }
    },

    async changeUsername() {
        if (!window.API) return;
        const user = window.API.getUser();
        const newName = prompt("请输入新的艺名：", user ? user.username : "");
        if (!newName || newName === user.username) return;
        
        try {
            await window.API.updateUsername(newName);
            this.renderAuthContent();
            this.updateNavAccount();
            this.renderCommunityHomeProfile();
            this.refreshCommunity();
            alert("艺名修改成功！");
        } catch(e) {
            alert("修改失败：" + e.message);
        }
    },

    logout() {
        const authModal = document.getElementById('auth-modal');
        const authOverlay = document.getElementById('auth-modal-overlay');
        const communityModal = document.getElementById('community-modal');
        const exportDropdown = document.getElementById('export-dropdown');
        if (window.API) window.API.clearToken();
        if (this.app) this.app._activeProjectId = null;
        if (authModal) authModal.classList.add('translate-x-full');
        if (authOverlay) {
            authOverlay.classList.add('opacity-0');
            setTimeout(() => authOverlay.classList.add('hidden'), 300);
        }
        if (communityModal) communityModal.classList.add('translate-y-full');
        if (exportDropdown) exportDropdown.classList.remove('show');
        this.currentView = 'diy';
        this.renderAuthContent();
        this.renderCommunityHomeProfile();
        this.updateNavAccount();
        this.showEntryLogin();
    },

    async saveCurrentProjectAsNew() {
        if (!this.app || !window.API) return;
        const name = prompt("给你的新作品起个名字吧：", "灵感花饽饽" + Math.floor(Math.random()*100));
        if (!name) return;
        try {
            const data = this.app.exportProjectState();
            const thumbnail = await this.app.captureSceneSnapshot();
            const res = await window.API.saveProject({ name, scene_data: data, thumbnail });

            this.app._activeProjectId = res.id;
            this.loadUserProjects();
            alert("已保存为新作品！");
        } catch (e) { alert("保存失败：" + e.message); }
    },

    async updateCurrentProject() {
        if (!this.app || !window.API || !this.app._activeProjectId) return;
        try {
            const data = this.app.exportProjectState();
            const thumbnail = await this.app.captureSceneSnapshot();
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
                this.showDIYView();
                await this.app.loadProjectState(p.scene_data);
                const modal = document.getElementById('auth-modal');
                const overlay = document.getElementById('auth-modal-overlay');
                if (modal) modal.classList.add('translate-x-full');
                if (overlay) {
                    overlay.classList.add('opacity-0');
                    setTimeout(() => overlay.classList.add('hidden'), 300);
                }
            }
        } catch(e) { alert("读取失败：" + e.message); }
    },

    toggleCommunity() {
        if (this.currentView === 'community') {
            this.showDIYView();
        } else {
            this.showCommunityHome();
        }
    },

    async refreshCommunity() {
        const grid = document.getElementById('community-grid');
        if (!grid || !window.API) return;
        grid.innerHTML = '<div class="col-span-full py-20 text-center text-slate-400" style="column-span: all;">正在获取最新灵感...</div>';

        try {
            const posts = await window.API.getCommunityPosts(30, 0);
            if (posts.length === 0) {
                grid.innerHTML = `
                <div class="col-span-full py-20 text-center text-slate-400" style="column-span: all;">
                    <p class="text-lg font-bold">暂无公开作品</p>
                    <p class="text-sm opacity-60 mt-1">快去分享你的创作吧！</p>
                </div>`;
                return;
            }

            grid.innerHTML = posts.map(p => {
                let thumbs = [];
                try {
                    thumbs = JSON.parse(p.thumbnail);
                    if (!Array.isArray(thumbs)) thumbs = [p.thumbnail];
                } catch(e) {
                    thumbs = p.thumbnail ? [p.thumbnail] : [];
                }

                return `
                <div class="waterfall-item group" id="community-card-${p.id}">
                    <div class="relative w-full overflow-hidden touch-pan-y" 
                         ontouchstart="UI.handleTouchStart(event)" 
                         ontouchend="UI.handleTouchEnd(event, '${p.id}', 'community')">
                        ${thumbs.length > 0 ? `
                            <img id="community-thumb-img-${p.id}" src="${thumbs[0]}" data-index="0" data-thumbs='${JSON.stringify(thumbs.filter(Boolean))}' class="waterfall-img transition-all duration-500">
                            ${thumbs.length > 1 ? `
                                <!-- Arrows (Desktop) -->
                                <button onclick="UI.prevThumbnail('${p.id}', event, 'community')" class="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-lg z-20">
                                    <i data-lucide="chevron-left" size="12" class="text-slate-800"></i>
                                </button>
                                <button onclick="UI.nextThumbnail('${p.id}', event, 'community')" class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-lg z-20">
                                    <i data-lucide="chevron-right" size="12" class="text-slate-800"></i>
                                </button>

                                <!-- Indicators -->

                                <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/10 backdrop-blur-md px-2 py-1 rounded-full">
                                    ${thumbs.map((_, idx) => `
                                        <div class="thumb-dot w-1.5 h-1.5 rounded-full bg-white/40 transition-all ${idx === 0 ? 'bg-white scale-125' : ''}"></div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        ` : '<div class="w-full aspect-[4/3] bg-slate-100"></div>'}
                    </div>
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
                `;
            }).join('');

            if (window.lucide) window.lucide.createIcons();


        } catch(e) {
            grid.innerHTML = `<div class="col-span-full py-10 text-center text-red-500">无法连接到社区网络</div>`;
        }
    },

    async likeCommunityPost(id, btnElement) {
        if (!window.API || !window.API.getToken()) {
            alert("请先登录账号才能点赞哦");
            this.showDIYView();
            this.showEntryLogin();
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
            const response = await fetch('/api/resources/models');
            const data = await response.json();
            
            // Format to match expected manifest structure
            this.app.modelManifest = {
                models: data.map(m => ({
                    id: m.id,
                    name: m.name,
                    file_name: m.file_name,
                    path: `/api/resources/models/${m.id}`,
                    thumbnail: m.thumbnail,
                    type: 'custom'
                }))

            };
            // Add default primitive
            this.app.modelManifest.models.unshift({ id: 'default', name: '圆球面团', type: 'primitive' });
            
            if (this.app.modelManifest.models.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10">暂无可用的模型资源</div>';
                return;
            }
            
            grid.innerHTML = this.app.modelManifest.models.map(model => `
                <div id="model-item-${model.id}" onclick="App.addNewLayer('${model.id}'); UI.toggleModelDialog()" 
                     class="group bg-slate-50 hover:bg-amber-50 p-4 rounded-[2rem] border-2 border-transparent hover:border-amber-200 transition-all cursor-pointer flex flex-col items-center gap-3">
                    <div class="thumbnail-container w-full aspect-square bg-[#f8fafc] rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-95 transition-transform overflow-hidden">
                        ${model.thumbnail ? `<img src="${model.thumbnail}" class="w-full h-full object-contain p-2">` : '<div class="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>'}
                    </div>
                    <span class="text-xs font-black text-slate-700 uppercase tracking-widest">${model.name}</span>
                </div>
            `).join('');

            // Background load and capture thumbnails if missing
            for (const model of this.app.modelManifest.models) {
                if (!model.thumbnail) {
                    this.generateModelPreview(model);
                }
            }

            
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error("Failed to load models from API", e);
            grid.innerHTML = '<p class="col-span-full text-center py-10 text-slate-400">加载模型库失败</p>';
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
                // Ensure we have correct extension info for loaders
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
