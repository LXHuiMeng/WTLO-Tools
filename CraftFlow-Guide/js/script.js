// script.js
class QuantumCalculator {
    constructor() {
        this.cache = new Map(); // 新增缓存
        this.recipes = {};
        this.recipeLevels = {};
        this.allMaterialNames = [];
        this.init();
    }

    async init() {
        await this.loadRecipes();
        this.renderOrderList();
        this.updateMaterialList();
        this.setupEventListeners();
    }
    async updateMaterialList() {
        const materials = await this.calculateMaterials();
        this.renderMaterialList(materials);
    }
    async loadRecipes() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/LXHuiMeng/WTLO-Tools/main/CraftFlow-Guide/config/index.json');
            this.recipes = await response.json();
            this.recipeLevels = this.calculateLevels();
            this.allMaterialNames = Object.keys(this.recipes).sort();
        } catch (error) {
            console.error('量子数据流中断:', error);
        }
    }

    calculateLevels() {
        const levels = {};

        const getLevel = (item) => {
            if (levels[item] !== undefined) return levels[item];
            if (!this.recipes[item]) return levels[item] = 0;
            
            const subLevels = Object.keys(this.recipes[item]).map(m => getLevel(m));
            return levels[item] = Math.max(...subLevels) + 1;
        };

        Object.keys(this.recipes).forEach(item => getLevel(item));
        return levels;
    }

    // 订单管理
    getOrders() {
        return JSON.parse(localStorage.getItem('quantumOrders')) || [];
    }

    // 在订单变更时清空缓存
    saveOrders(orders) {
        localStorage.setItem('quantumOrders', JSON.stringify(orders));
        this.cache.clear(); // 清空缓存
    }

    addOrder(name, quantity) {
        if (!this.recipes[name] || quantity < 1) return false;
        
        const orders = this.getOrders();
        orders.push({ name, quantity });
        this.saveOrders(orders);
        return true;
    }

    removeOrder(index) {
        const orders = this.getOrders();
        orders.splice(index, 1);
        this.saveOrders(orders);
    }

    // 材料计算
    async calculateMaterials() {
        const cacheKey = JSON.stringify(this.getOrders());
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        const orders = this.getOrders();
        const materials = {};

        for (const order of orders) {
            // 特别标记顶层订单项不加入材料清单
            await this._processMaterial(order.name, order.quantity, materials, true);
        }

        const result = this.groupByLevel(materials);
        this.cache.set(cacheKey, result);
        return result;
    }

    async _processMaterial(name, quantity, materials, isTopLevel = false) {
        // 如果是顶层订单项，只处理子材料
        if (isTopLevel) {
            if (!this.recipes[name]) return;
            for (const [mat, needed] of Object.entries(this.recipes[name])) {
                await this._processMaterial(mat, needed * quantity, materials, false);
            }
            return;
        }

        // 普通材料处理逻辑
        materials[name] = (materials[name] || 0) + quantity;
        
        if (!this.recipes[name]) return; // 基础材料不再向下分解
        
        // 递归处理子材料
        for (const [mat, needed] of Object.entries(this.recipes[name])) {
            await this._processMaterial(mat, needed * quantity, materials, false);
        }
    }

    groupByLevel(materials) {
        return Object.entries(materials).reduce((acc, [name, qty]) => {
            const level = this.recipeLevels[name] || 0;
            acc[level] = acc[level] || {};
            acc[level][name] = qty;
            return acc;
        }, {});
    }

    // 界面渲染
    renderOrderList() {
        const orders = this.getOrders();
        const list = document.getElementById('orderList');
        
        list.innerHTML = orders.map((order, index) => `
            <div class="order-item" data-quantum="${order.quantity}">
                <span>${order.name}</span>
                <div>
                    <span class="quantum-value">×${order.quantity}</span>
                    <i class="delete-btn" onclick="deleteOrderItem(${index})">✖</i>
                </div>
            </div>
        `).join('');
    }

    renderMaterialList(materials) {
        const container = document.getElementById('materialList');
        const sortedLevels = Object.keys(materials).sort((a, b) => b - a);

        // 修正层级显示逻辑
        container.innerHTML = sortedLevels.map(level => `
            <div class="quantum-group">
                <div class="group-title">
                    层级 ${level}
                    <span class="quantum-marker">⏣${level}</span>
                </div>
                ${Object.entries(materials[level]).map(([name, qty]) => `
                    <div class="material-item">
                        <span class="particle-trail"></span>
                        ${name} 
                        <span class="quantum-value">×${qty}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');

        if (sortedLevels.length === 0) {
            container.innerHTML = `<div class="quantum-empty">⏣ 当前无材料需求</div>`;
        }
        const total = Object.values(materials).flatMap(level => Object.values(level)).reduce((a,b)=>a+b,0);
        container.insertAdjacentHTML('beforeend', `
            <div class="summary">
                总材料需求: ${total} 单位
            </div>
        `);
    }

    // 事件监听
    setupEventListeners() {
        const searchInput = document.getElementById('itemName');
        const suggestions = document.getElementById('suggestions');
        let isMouseOverSuggestions = false;
        let timeout;
    
        // 1. 搜索框点击事件 - 切换建议列表显示/隐藏
        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
            if (suggestions.style.display === 'block') {
                suggestions.style.display = 'none';
            } else {
                this.showSuggestions('', true);
            }
        });
    
        // 2. 鼠标进入/离开建议列表的跟踪
        suggestions.addEventListener('mouseenter', () => {
            isMouseOverSuggestions = true;
        });
    
        suggestions.addEventListener('mouseleave', () => {
            isMouseOverSuggestions = false;
            suggestions.style.display = 'none';
        });
    
        // 3. 全局点击隐藏建议列表（排除搜索栏区域）
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.cyber-input-group')) {
                suggestions.style.display = 'none';
            }
        });
    
        // 4. 建议列表滚轮滚动功能
        suggestions.addEventListener('wheel', (e) => {
            e.preventDefault();
            suggestions.scrollTop += e.deltaY;
        });
    
        // 5. 输入防抖处理
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.showSuggestions(e.target.value);
            }, 300);
        });
    
        // 6. 点击建议项填充内容
        suggestions.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                e.preventDefault(); // 防止输入框失去焦点
                searchInput.value = item.dataset.name; // 统一使用 data-name
                suggestions.style.display = 'none';
                searchInput.focus();
            }
        });
    
        // 7. 键盘导航支持
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = suggestions.querySelectorAll('.suggestion-item');
                if (items.length === 0) return;
    
                let index = Array.from(items).findIndex(item => 
                    item.classList.contains('selected')
                );
                
                if (e.key === 'ArrowDown') {
                    index = (index + 1) % items.length;
                } else {
                    index = (index - 1 + items.length) % items.length;
                }
    
                items.forEach(item => item.classList.remove('selected'));
                items[index].classList.add('selected');
                items[index].scrollIntoView({ block: 'nearest' });
            }
    
            if (e.key === 'Enter') {
                const selected = suggestions.querySelector('.selected');
                if (selected) {
                    searchInput.value = selected.dataset.name;
                    suggestions.style.display = 'none';
                }
            }
        });
    }


    showSuggestions(searchText, forceShowAll = false) {
        const searchInput = document.getElementById('itemName');
        const suggestions = document.getElementById('suggestions');
        
        const inputRect = searchInput.getBoundingClientRect();
        suggestions.style.width = `${inputRect.width}px`;
        suggestions.style.display = 'block';
        suggestions.scrollTop = 0;
    
        // 移除旧的点击事件监听器
        suggestions.removeEventListener('click', this.suggestionClickHandler);
        
        // 统一使用 data-name 属性
        this.suggestionClickHandler = (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                searchInput.value = item.dataset.name;
                suggestions.style.display = 'none';
                searchInput.focus();
            }
        };
        
        suggestions.addEventListener('click', this.suggestionClickHandler);
    
        // 过滤逻辑保持不变
        const filtered = (forceShowAll || searchText === '') 
            ? this.allMaterialNames.filter(name => 
                this.recipes[name] && 
                this.recipeLevels[name] > 0
              )
            : this.allMaterialNames.filter(name => 
                name.toLowerCase().includes(searchText.toLowerCase()) && 
                this.recipeLevels[name] > 0
            );
    
        filtered.sort((a, b) => {
            return this.recipeLevels[b] - this.recipeLevels[a];
        });
    
        // 确保使用 data-name 属性
        suggestions.innerHTML = filtered.map(name => {
            const level = this.recipeLevels[name];
            return `
            <div class="suggestion-item" data-name="${name}">
                <span class="material-name">${name}</span>
                <span class="level-badge">Lv.${level}</span>
            </div>
            `;
        }).join('');
    
        suggestions.style.display = filtered.length ? 'block' : 'none';
    }
}

// 全局访问方法
const calculator = new QuantumCalculator();

function addOrderItem() {
    const name = document.getElementById('itemName').value.trim();
    const quantity = parseInt(document.getElementById('itemQuantity').value);

    if (calculator.addOrder(name, quantity)) {
        document.getElementById('itemName').value = '';
        calculator.renderOrderList();
        calculator.updateMaterialList();
    } else {
        showError('无效的量子配方!');
    }
}

async function deleteOrderItem(index) {
    calculator.removeOrder(index);
    calculator.renderOrderList();
    await calculator.updateMaterialList();
}

function selectSuggestion(name) {
    document.getElementById('itemName').value = name;
    document.getElementById('suggestions').style.display = 'none';
}

function showError(msg) {
    const error = document.createElement('div');
    error.className = 'quantum-error';
    error.textContent = msg;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 2000);
}

// 初始化动效
document.querySelectorAll('[data-glitch-text]').forEach(el => {
    el.addEventListener('input', () => {
        el.style.textShadow = `0 0 ${Math.random()*10+5}px rgba(0,243,255,${Math.random()*0.5})`;
    });
});

// 右键清除输入
document.getElementById('itemName').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.target.value = '';
    document.getElementById('suggestions').style.display = 'none';
});
