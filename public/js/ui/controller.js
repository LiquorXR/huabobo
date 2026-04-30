import { API } from '../api/client.js';

export const UI = {
    app: null,
    currentView: 'diy',
    _lastSavedProjectName: null,
    _activeDialog: null,
    _dismissTimer: null,
    _accountTimer: null,

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
            this.routeAuthenticatedUser(window.API.getUser(), false);
        }
    },

    routeAuthenticatedUser(user, refresh = true) {
        if (!user) {
            this.currentView = 'diy';
            this.updateNavAccount();
            return;
        }

        if (user.role === 'admin') {
            window.location.href = '/admin.html';
            return;
        }

        this.showCommunityHome(refresh);
    },

    updateNavAccount() {
        const user = window.API ? window.API.getUser() : null;
        const communityButtonLabel = document.getElementById('community-nav-label');
        const exportMenu = document.getElementById('export-menu-container');
        const diyActions = document.getElementById('diy-workspace-actions');
        const communityBtn = document.getElementById('community-nav-btn');
        const topHeader = document.getElementById('top-header');
        const studioAtmosphere = document.getElementById('studio-atmosphere');

        if (communityButtonLabel) {
            communityButtonLabel.innerText = '灵感社区';
        }

        if (exportMenu) {
            exportMenu.classList.toggle('hidden', this.currentView === 'community');
        }

        if (diyActions) {
            diyActions.classList.toggle('hidden', this.currentView !== 'diy' || !user || user.role === 'admin');
            diyActions.classList.toggle('flex', this.currentView === 'diy' && !!user && user.role !== 'admin');
        }

        if (communityBtn) {
            communityBtn.classList.toggle('hidden', !user || user.role === 'admin' || this.currentView === 'community');
            communityBtn.classList.add('bg-white/70', 'text-rose-500', 'border-white/50');
            communityBtn.classList.remove('bg-rose-500', 'text-white', 'border-rose-400', 'shadow-rose-500/20');
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

    _dialogConfigMap: {
        info: {
            kicker: 'System',
            title: '提示',
            icon: 'sparkles',
            iconClass: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20'
        },
        success: {
            kicker: 'Success',
            title: '操作成功',
            icon: 'check',
            iconClass: 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/20'
        },
        warning: {
            kicker: 'Warning',
            title: '请确认',
            icon: 'triangle-alert',
            iconClass: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20'
        },
        error: {
            kicker: 'Error',
            title: '操作失败',
            icon: 'circle-alert',
            iconClass: 'bg-gradient-to-br from-rose-400 to-red-500 shadow-lg shadow-rose-500/20'
        }
    },

    getDialogElements() {
        return {
            overlay: document.getElementById('app-dialog-overlay'),
            dialog: document.getElementById('app-dialog'),
            kicker: document.getElementById('app-dialog-kicker'),
            title: document.getElementById('app-dialog-title'),
            message: document.getElementById('app-dialog-message'),
            iconWrap: document.getElementById('app-dialog-icon'),
            icon: document.getElementById('app-dialog-icon-symbol'),
            inputWrap: document.getElementById('app-dialog-input-wrap'),
            inputLabel: document.getElementById('app-dialog-input-label'),
            input: document.getElementById('app-dialog-input'),
            actions: document.getElementById('app-dialog-actions')
        };
    },

    dismissDialog() {
        if (!this._activeDialog) return;
        const { overlay, dialog } = this.getDialogElements();
        if (!overlay || !dialog) return;
        dialog.classList.add('opacity-0', 'scale-95');
        overlay.classList.add('opacity-0');
        clearTimeout(this._dismissTimer);
        this._dismissTimer = setTimeout(() => {
            dialog.classList.add('hidden');
            overlay.classList.add('hidden');
            this._dismissTimer = null;
        }, 300);

        const active = this._activeDialog;
        this._activeDialog = null;
        if (active && active.resolve) {
            active.resolve(active.fallbackValue);
        }
    },

    showAccountSettings(initialFocus = 'username') {
        if (!window.API) return;
        const user = window.API.getUser();
        const overlay = document.getElementById('account-settings-overlay');
        const dialog = document.getElementById('account-settings-dialog');
        const usernameInput = document.getElementById('account-settings-username');
        const currentPasswordInput = document.getElementById('account-settings-current-password');
        const newPasswordInput = document.getElementById('account-settings-new-password');
        const confirmPasswordInput = document.getElementById('account-settings-confirm-password');

        if (!user || !overlay || !dialog || !usernameInput || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
            return;
        }

        if (this._activeDialog) {
            this.dismissDialog();
        }

        usernameInput.value = user.username || '';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

        clearTimeout(this._accountTimer);
        this._accountTimer = null;

        overlay.classList.remove('hidden');
        dialog.classList.remove('hidden');

        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            dialog.classList.remove('opacity-0', 'scale-95');
            const focusMap = {
                password: currentPasswordInput,
                newPassword: newPasswordInput,
                username: usernameInput
            };
            const focusTarget = focusMap[initialFocus] || usernameInput;
            focusTarget.focus();
            if (window.lucide) window.lucide.createIcons({ root: dialog });
        }, 10);
    },

    hideAccountSettings() {
        const overlay = document.getElementById('account-settings-overlay');
        const dialog = document.getElementById('account-settings-dialog');
        if (!overlay || !dialog) return;

        dialog.classList.add('opacity-0', 'scale-95');
        overlay.classList.add('opacity-0');
        clearTimeout(this._accountTimer);
        this._accountTimer = setTimeout(() => {
            dialog.classList.add('hidden');
            overlay.classList.add('hidden');
            this._accountTimer = null;
        }, 300);
    },

    async submitAccountSettings() {
        if (!window.API) return;
        const user = window.API.getUser();
        if (!user) return;

        const usernameInput = document.getElementById('account-settings-username');
        const currentPasswordInput = document.getElementById('account-settings-current-password');
        const newPasswordInput = document.getElementById('account-settings-new-password');
        const confirmPasswordInput = document.getElementById('account-settings-confirm-password');
        if (!usernameInput || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;

        const newUsername = usernameInput.value.trim();
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const usernameChanged = !!newUsername && newUsername !== user.username;
        const wantsPasswordChange = !!currentPassword || !!newPassword || !!confirmPassword;

        if (!newUsername) {
            await this.showAlert('艺名不能为空', 'warning', '信息不完整');
            return;
        }

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                await this.showAlert('修改密码时请完整填写当前密码、新密码和确认密码', 'warning', '信息不完整');
                return;
            }

            if (newPassword !== confirmPassword) {
                await this.showAlert('两次输入的新密码不一致，请重新确认', 'warning', '信息不一致');
                return;
            }
        }

        if (!usernameChanged && !wantsPasswordChange) {
            await this.showAlert('未检测到需要保存的更改', 'warning', '无需保存');
            return;
        }

        try {
            await window.API.updateAccountSettings({
                newUsername: usernameChanged ? newUsername : '',
                currentPassword: wantsPasswordChange ? currentPassword : '',
                newPassword: wantsPasswordChange ? newPassword : ''
            });
            this.hideAccountSettings();
            this.updateNavAccount();
            this.renderCommunityHomeProfile();
            this.refreshCommunity();

            const successMessage = usernameChanged && wantsPasswordChange
                ? '艺名和密码都已更新！'
                : usernameChanged
                    ? '艺名修改成功！'
                    : '密码修改成功！';
            await this.showAlert(successMessage, 'success', '已保存');
        } catch (e) {
            await this.showAlert('保存失败：' + e.message, 'error', '保存失败');
        }
    },

    openDialog(options = {}) {
        const els = this.getDialogElements();
        if (!els.overlay || !els.dialog) {
            return Promise.resolve(options.fallbackValue ?? null);
        }

        if (this._activeDialog) {
            this.dismissDialog();
        }

        const tone = this._dialogConfigMap[options.tone || 'info'] || this._dialogConfigMap.info;
        els.kicker.innerText = options.kicker || tone.kicker;
        els.title.innerText = options.title || tone.title;
        els.message.innerText = options.message || '';
        els.iconWrap.className = `w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 ${options.iconClass || tone.iconClass}`;
        els.icon.setAttribute('data-lucide', options.icon || tone.icon);

        const needsInput = options.mode === 'prompt';
        els.inputWrap.classList.toggle('hidden', !needsInput);
        if (needsInput) {
            els.inputLabel.innerText = options.inputLabel || '输入内容';
            els.input.value = options.initialValue || '';
            els.input.placeholder = options.placeholder || '';
        }

        els.actions.innerHTML = '';

        const buttons = options.buttons || [{ label: '知道了', value: true, kind: 'primary' }];
        buttons.forEach((button) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerText = button.label;
            btn.className = button.kind === 'secondary'
                ? 'px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors'
                : button.kind === 'danger'
                    ? 'px-4 py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors'
                    : 'px-4 py-3 rounded-xl bg-amber-500 text-amber-950 font-bold hover:bg-amber-400 transition-colors';
            btn.onclick = () => {
                const resolver = this._activeDialog;
                this._activeDialog = null;
                els.dialog.classList.add('opacity-0', 'scale-95');
                els.overlay.classList.add('opacity-0');
                clearTimeout(this._dismissTimer);
                this._dismissTimer = setTimeout(() => {
                    els.dialog.classList.add('hidden');
                    els.overlay.classList.add('hidden');
                    this._dismissTimer = null;
                }, 300);
                if (resolver && resolver.resolve) {
                    resolver.resolve(needsInput && button.value === true ? els.input.value : button.value);
                }
            };
            els.actions.appendChild(btn);
        });

        return new Promise((resolve) => {
            this._activeDialog = {
                resolve,
                fallbackValue: options.fallbackValue ?? (needsInput ? null : false)
            };

            clearTimeout(this._dismissTimer);
            this._dismissTimer = null;

            els.overlay.classList.remove('hidden');
            els.dialog.classList.remove('hidden');
            setTimeout(() => {
                els.overlay.classList.remove('opacity-0');
                els.dialog.classList.remove('opacity-0', 'scale-95');
                if (needsInput) {
                    els.input.focus();
                    els.input.select();
                }
                if (window.lucide) window.lucide.createIcons({ root: els.dialog });
            }, 10);
        });
    },

    showAlert(message, tone = 'info', title = '') {
        return this.openDialog({
            mode: 'alert',
            message,
            tone,
            title,
            buttons: [{ label: '知道了', value: true, kind: tone === 'error' ? 'danger' : 'primary' }],
            fallbackValue: true
        });
    },

    showConfirm(message, options = {}) {
        return this.openDialog({
            mode: 'confirm',
            message,
            tone: options.tone || 'warning',
            title: options.title || '请确认',
            buttons: [
                { label: options.cancelLabel || '取消', value: false, kind: 'secondary' },
                { label: options.confirmLabel || '确认', value: true, kind: options.confirmKind || 'primary' }
            ],
            fallbackValue: false
        });
    },

    showPrompt(message, options = {}) {
        return this.openDialog({
            mode: 'prompt',
            message,
            tone: options.tone || 'info',
            title: options.title || '请输入',
            inputLabel: options.inputLabel || '输入内容',
            initialValue: options.initialValue || '',
            placeholder: options.placeholder || '',
            buttons: [
                { label: options.cancelLabel || '取消', value: false, kind: 'secondary' },
                { label: options.confirmLabel || '确认', value: true, kind: 'primary' }
            ],
            fallbackValue: null
        });
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
        const usernameLabel = document.getElementById('entry-username-label');
        const usernameInput = document.getElementById('entry-username');
        const emailField = document.getElementById('entry-email-field');

        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            submitBtn.innerText = '开启艺术之旅';
            if (usernameLabel) usernameLabel.innerText = '艺名 / 用户名 / 邮箱';
            if (usernameInput) usernameInput.placeholder = '输入艺名或邮箱';
            if (emailField) emailField.classList.add('hidden');
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            submitBtn.innerText = '加入数字传承';
            if (usernameLabel) usernameLabel.innerText = '艺名 / 用户名';
            if (usernameInput) usernameInput.placeholder = '输入您的昵称';
            if (emailField) emailField.classList.remove('hidden');
        }
    },

    async submitEntryAuth() {
        const userStr = document.getElementById('entry-username').value.trim();
        const passStr = document.getElementById('entry-password').value;
        const emailInput = document.getElementById('entry-email');
        const emailStr = emailInput ? emailInput.value.trim() : '';
        if (!userStr || !passStr) {
            await this.showAlert("请输入完整的账号密码", 'warning', '信息不完整');
            return;
        }

        try {
            let user;
            if (this._entryTab === 'login') {
                user = await window.API.login(userStr, passStr);
            } else {
                const availability = await window.API.checkRegisterAvailability(userStr, emailStr);
                if (!availability.usernameAvailable) {
                    await this.showAlert('当前用户名已被注册，请更换后再试', 'warning', '注册失败');
                    return;
                }
                if (emailStr && !availability.emailAvailable) {
                    await this.showAlert('当前邮箱已被注册，请更换后再试', 'warning', '注册失败');
                    return;
                }
                user = await window.API.register(userStr, passStr, emailStr);
            }
            this.hideEntryLogin();
            this.updateNavAccount();
            this.routeAuthenticatedUser(user);
        } catch (e) {
            await this.showAlert(
                (this._entryTab === 'login' ? "登录" : "注册") + "失败：" + e.message,
                'error',
                this._entryTab === 'login' ? '登陆失败' : '注册失败'
            );
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

    async loadUserProjects() {
        const lists = [
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
                } catch (e) {
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
                        <div class="absolute top-1.5 right-1.5 z-30">
                            <button onclick="UI.toggleProjectMenu('${p.id}', event)" class="w-4 h-4 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 shadow-sm hover:bg-white transition-all">
                                <i data-lucide="more-vertical" size="6"></i>
                            </button>
                            <!-- Dropdown Menu -->
                            <div id="project-menu-${p.id}" class="hidden absolute right-0 mt-1 w-20 bg-white rounded-md shadow-2xl border border-slate-100 py-0.5 animate-in fade-in zoom-in duration-200">
                                <button onclick="UI.loadProject('${p.id}')" class="w-full px-1.5 py-0.5 text-left text-[9px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-0.5"><i data-lucide="edit-3" size="4"></i> 编辑作品</button>
                                <button onclick="UI.shareProject('${p.id}', ${!p.is_public})" class="w-full px-1.5 py-0.5 text-left text-[9px] font-bold ${p.is_public ? 'text-amber-600' : 'text-emerald-600'} hover:bg-slate-50 flex items-center gap-0.5">
                                    <i data-lucide="${p.is_public ? 'eye-off' : 'share'}" size="4"></i> ${p.is_public ? '取消发布' : '发布社区'}
                                </button>
                                <button onclick="UI.renameProject('${p.id}', '${p.name.replace(/'/g, "\\'")}')" class="w-full px-1.5 py-0.5 text-left text-[9px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-0.5"><i data-lucide="pencil" size="4"></i> 重命名</button>
                                <div class="h-px bg-slate-100 my-0"></div>
                                <button onclick="UI.deleteProject('${p.id}')" class="w-full px-1.5 py-0.5 text-left text-[9px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-0.5"><i data-lucide="trash-2" size="4"></i> 删除记录</button>
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
                        <div class="relative w-16 h-16 rounded-[1.4rem] bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 border border-amber-200/70 shadow-lg shrink-0 overflow-hidden flex items-center justify-center">
                            <div class="absolute -top-2 -right-1 w-7 h-7 rounded-full bg-amber-300/50 blur-md"></div>
                            <div class="absolute -bottom-2 -left-1 w-8 h-8 rounded-full bg-rose-200/45 blur-md"></div>
                            <div class="relative w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center shadow-[0_8px_18px_rgba(249,115,22,0.28)]">
                                <i data-lucide="flower-2" size="20" class="text-white"></i>
                            </div>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">我的艺名</p>
                            <h4 class="font-black text-slate-800 text-xl truncate">${user.username}</h4>
                        </div>
                        <button onclick="UI.showAccountSettings()" class="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all shrink-0">
                            <i data-lucide="edit-3" size="18"></i>
                        </button>
                    </div>
                </div>
                <div class="p-5 lg:p-6 flex flex-col gap-4">
                    <div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">登录邮箱</p>
                            <p class="text-sm font-semibold text-slate-700 break-all">${user.email || '未绑定邮箱'}</p>
                            <p class="text-xs text-slate-500 mt-1">绑定后可直接使用邮箱登录</p>
                        </div>
                        <button onclick="UI.changeEmail()" class="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors shrink-0">
                            ${user.email ? '修改邮箱' : '绑定邮箱'}
                        </button>
                    </div>
                    <button onclick="UI.showAccountSettings('password')" class="w-full py-3 text-slate-700 font-bold bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">账号设置</button>
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
        this.showEntryLogin();
    },

    async submitRegister() {
        this.showEntryLogin();
    },

    async changeUsername() {
        this.showAccountSettings();
    },

    async changeEmail() {
        if (!window.API) return;
        const user = window.API.getUser();
        const newEmail = await this.showPrompt("请输入要绑定的邮箱，留空可解除绑定", {
            title: user && user.email ? '修改邮箱' : '绑定邮箱',
            inputLabel: '邮箱地址',
            initialValue: user && user.email ? user.email : '',
            placeholder: 'name@example.com'
        });
        if (newEmail === null) return;
        if (user && newEmail.trim() === (user.email || '')) return;

        try {
            await window.API.updateEmail(newEmail);
            this.updateNavAccount();
            this.renderCommunityHomeProfile();
            await this.showAlert(newEmail.trim() ? '邮箱绑定成功！' : '邮箱已解除绑定。', 'success', '已保存');
        } catch (e) {
            await this.showAlert("修改失败：" + e.message, 'error', '修改失败');
        }
    },

    async changePassword() {
        this.showAccountSettings('password');
    },

    async logout() {
        const confirmed = await this.showConfirm("退出后将返回登录入口，是否继续？", {
            title: '退出登录',
            confirmLabel: '确认退出',
            confirmKind: 'danger'
        });
        if (!confirmed) return;

        const communityModal = document.getElementById('community-modal');
        const exportDropdown = document.getElementById('export-dropdown');
        if (window.API) window.API.clearToken();
        if (this.app) this.app._activeProjectId = null;
        if (communityModal) communityModal.classList.add('translate-y-full');
        if (exportDropdown) exportDropdown.classList.remove('show');
        this.currentView = 'diy';
        this._lastSavedProjectName = null;
        this.renderCommunityHomeProfile();
        this.updateNavAccount();
        this.showEntryLogin();
    },

    async saveCurrentProjectAsNew() {
        if (!this.app || !window.API) return null;
        const defaultName = this._lastSavedProjectName || ("灵感花饽饽" + Math.floor(Math.random() * 100));
        const name = await this.showPrompt("给你的新作品起个名字吧", {
            title: '保存新作品',
            inputLabel: '作品名称',
            initialValue: defaultName,
            placeholder: '输入作品名称'
        });
        if (!name) return;
        try {
            const data = this.app.exportProjectState();
            const thumbnail = await this.app.captureSceneSnapshot();
            const res = await window.API.saveProject({ name, scene_data: data, thumbnail });

            this.app._activeProjectId = res.id;
            this._lastSavedProjectName = res.name || name;
            await this.loadUserProjects();
            await this.refreshCommunity();
            await this.showAlert("已保存为新作品！", 'success', '保存成功');
            return res;
        } catch (e) {
            await this.showAlert("保存失败：" + e.message, 'error', '保存失败');
        }
        return null;
    },

    async updateCurrentProject() {
        if (!this.app || !window.API || !this.app._activeProjectId) return null;
        try {
            const data = this.app.exportProjectState();
            const thumbnail = await this.app.captureSceneSnapshot();
            const res = await window.API.saveProject({ id: this.app._activeProjectId, scene_data: data, thumbnail });

            this._lastSavedProjectName = res.name || this._lastSavedProjectName;
            await this.loadUserProjects();
            await this.refreshCommunity();
            await this.showAlert("已更新！", 'success', '保存成功');
            return res;
        } catch (e) {
            await this.showAlert("更新失败：" + e.message, 'error', '更新失败');
        }
        return null;
    },

    async saveCurrentProject() {
        if (!window.API || !window.API.getUser()) {
            this.showEntryLogin();
            return;
        }

        if (this.app && this.app._activeProjectId) {
            await this.updateCurrentProject();
            return;
        }

        await this.saveCurrentProjectAsNew();
    },

    async saveAndReturnToDashboard() {
        if (!window.API || !window.API.getUser()) {
            this.showEntryLogin();
            return;
        }

        let result = null;
        if (this.app && this.app._activeProjectId) {
            result = await this.updateCurrentProject();
        } else {
            result = await this.saveCurrentProjectAsNew();
        }

        if (!result) return;

        this.showCommunityHome(true);
    },

    async deleteProject(id) {
        const shouldDelete = await this.showConfirm("确定要删除这个存档吗？", {
            title: '删除存档',
            confirmLabel: '删除',
            confirmKind: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await window.API.deleteProject(id);
            if (this.app && this.app._activeProjectId === id) this.app._activeProjectId = null;
            await this.loadUserProjects();
            await this.refreshCommunity();
        } catch (e) {
            await this.showAlert("删除失败：" + e.message, 'error', '删除失败');
        }
    },

    async shareProject(id, isPublic) {
        try {
            await window.API.saveProject({ id: id, is_public: isPublic });
            await this.loadUserProjects();
            await this.refreshCommunity();
        } catch (e) {
            await this.showAlert("操作失败：" + e.message, 'error', '操作失败');
        }
    },

    async renameProject(id, currentName) {
        const name = await this.showPrompt("给作品换个名字吧", {
            title: '重命名作品',
            inputLabel: '作品名称',
            initialValue: currentName,
            placeholder: '输入新的作品名称'
        });
        if (!name || name === currentName) return;
        try {
            await window.API.saveProject({ id, name });
            if (this.app && this.app._activeProjectId === id) {
                this._lastSavedProjectName = name;
            }
            await this.loadUserProjects();
            await this.refreshCommunity();
        } catch (e) {
            await this.showAlert("重命名失败：" + e.message, 'error', '重命名失败');
        }
    },

    async loadProject(id) {
        try {
            const projects = await window.API.getMyProjects();
            const p = projects.find(x => x.id === id);
            if (p && p.scene_data && this.app) {
                this.app._activeProjectId = p.id;
                this._lastSavedProjectName = p.name || null;
                this.showDIYView();
                await this.app.loadProjectState(p.scene_data);
            }
        } catch (e) {
            await this.showAlert("读取失败：" + e.message, 'error', '读取失败');
        }
    },

    async createNewProject() {
        if (!window.API || !window.API.getUser()) {
            this.showEntryLogin();
            return;
        }

        const confirmed = await this.showConfirm("创建新作品会清空当前未保存的制作内容，是否继续？", {
            title: '创建新作品',
            confirmLabel: '继续创建',
            confirmKind: 'primary'
        });
        if (!confirmed) return;

        try {
            if (this.app) {
                this.app._activeProjectId = null;
                this._lastSavedProjectName = null;
                await this.app.startFreshProject();
            }
            this.showDIYView();
        } catch (e) {
            await this.showAlert("创建新作品失败：" + e.message, 'error', '创建失败');
        }
    },

    toggleCommunity() {
        const user = window.API ? window.API.getUser() : null;
        if (!user) {
            this.showEntryLogin();
            return;
        }

        if (user.role === 'admin') {
            window.location.href = '/admin.html';
            return;
        }

        this.showCommunityHome();
    },

    async refreshCommunity() {
        const grid = document.getElementById('community-grid');
        if (!grid || !window.API) return;
        grid.innerHTML = '';

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
                } catch (e) {
                    thumbs = p.thumbnail ? [p.thumbnail] : [];
                }

                return `
                <div class="waterfall-item group" id="community-card-${p.id}">
                     <div class="relative w-full overflow-hidden touch-pan-y" 
                         ontouchstart="UI.handleTouchStart(event)" 
                         ontouchend="UI.handleTouchEnd(event, '${p.id}', 'community')">
                        <span class="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[11px] font-bold text-black truncate max-w-[150px] block">${p.name}</span>
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
                        <div class="flex flex-col min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <div class="relative w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 border border-amber-200/70 flex items-center justify-center shrink-0 overflow-hidden">
                                    <div class="absolute inset-[4px] rounded-full bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center">
                                        <i data-lucide="flower-2" size="12" class="text-white"></i>
                                    </div>
                                </div>
                                <div class="min-w-0">
                                    <span class="text-xs font-bold text-slate-600 truncate block max-w-[80px]">${p.author}</span>
                                    <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">${new Date(p.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
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


        } catch (e) {
            grid.innerHTML = `<div class="col-span-full py-10 text-center text-red-500">无法连接到社区网络</div>`;
        }
    },

    async likeCommunityPost(id, btnElement) {
        if (!window.API || !window.API.getToken()) {
            await this.showAlert("请先登录账号才能点赞哦", 'warning', '需要登录');
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
        } catch (e) { }
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

    streamingStart() {
        const content = document.getElementById('master-speech-content');
        const dots = document.getElementById('master-thinking-dots');
        if (!content) return;

        const dialog = document.getElementById('master-dialog');
        if (dialog && dialog.classList.contains('hidden')) {
            this.toggleMasterDialog();
        }

        if (dots) dots.classList.add('hidden');
        content.innerText = '';
    },

    appendStreamText(text) {
        const content = document.getElementById('master-speech-content');
        if (!content) return;
        content.innerText += text;
    },

    showReasoningProgress() {
        const content = document.getElementById('master-speech-content');
        if (content) {
            content.innerText = "师傅正在深度思考，请稍候...";
        }
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
