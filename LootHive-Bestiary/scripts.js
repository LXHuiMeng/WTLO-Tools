
const LOOT_FILE = './database/biome-drops.json';
const PRICE_FILE = '../Item-Track/database/Item.json';
const COLOR_PALETTE = ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFDFBA', '#D0BAFF'];
let monsterColors = {};
let currentData = [];
let sortState = { column: null, order: 0 };
let maxValues = { price: 0, weight: 0, ppk: 0 };
let itemSourceMap = {};
let lootData = {};
let priceData = {};
let merchantMultiplier = 1.0; // 默认商人倍率

// 初始化
async function init() {
    await loadExternalData();
    initializeData();
    setupEventListeners();
    updateView();
}

// 新增数据加载函数
async function loadExternalData() {
    try {
        const lootResponse = await fetch(LOOT_FILE);
        lootData = await lootResponse.json();

        const priceResponse = await fetch(PRICE_FILE);
        const priceArray = await priceResponse.json();
        priceData = Object.fromEntries(priceArray.map(item => [item.name, item]));
    } catch (error) {
        console.error('数据加载失败:', error);
        lootData = {};
        priceData = {};
    }
}

function initializeData() {
    generateColorMap();
    buildItemSourceMap();
    processRawData();
}

function generateColorMap() {
    let colorIndex = 0;
    Object.keys(lootData).forEach(monster => {
        monsterColors[monster] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
    });
}

function buildItemSourceMap() {
    itemSourceMap = {};
    Object.entries(lootData).forEach(([monster, drops]) => {
        drops.forEach(itemName => {
            if (!itemSourceMap[itemName]) {
                itemSourceMap[itemName] = new Set();
            }
            itemSourceMap[itemName].add(monster);
        });
    });
}

function processRawData() {
    const mergedItems = {};
    Object.entries(lootData).forEach(([monster, drops]) => {
        drops.forEach(itemName => {
            const priceInfo = priceData[itemName];
            if (!priceInfo) return;

            if (!mergedItems[itemName]) {
                mergedItems[itemName] = {
                    item: itemName,
                    price: priceInfo.price,
                    weight: priceInfo.weight,
                    ppk: priceInfo.price / priceInfo.weight,
                    monsters: new Set([monster]),
                    display: true
                };
            } else {
                mergedItems[itemName].monsters.add(monster);
            }
        });
    });

    currentData = Object.values(mergedItems).map(item => ({
        ...item,
        price: Number((item.price * merchantMultiplier).toFixed(2)),
        ppk: Number((item.ppk * merchantMultiplier).toFixed(2))
    }));

    calculateMaxValues();
}

function updatePrices() {
    merchantMultiplier = parseFloat(document.getElementById('merchantSelect').value);
    processRawData();
    updateView();
}

function calculateMaxValues() {
    maxValues = {
        price: Math.max(...currentData.map(d => d.price)),
        weight: Math.max(...currentData.map(d => d.weight)),
        ppk: Math.max(...currentData.map(d => d.ppk))
    };
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        this.value = '';
        this.dispatchEvent(new Event('input'));
        updateAutocomplete.call(this);
    });

    searchInput.addEventListener('input', function() {
        updateAutocomplete.call(this);
        searchData();
    });

    searchInput.addEventListener('focus', () => updateAutocomplete.call(searchInput));
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            document.getElementById('autocompleteList').style.display = 'none';
        }, 100);
    });

    // 物品列悬停事件
    document.addEventListener('mouseover', (e) => {
        const itemCell = e.target.closest('td:first-child');
        if (itemCell) {
            const item = itemCell.closest('tr').dataset.item;
            showTooltip(item, e);
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('td:first-child')) {
            hideTooltip();
        }
    });
}

// 新增的自动完成更新函数
function updateAutocomplete() {
    const query = this.value.toLowerCase();
    const list = document.getElementById('autocompleteList');
    list.innerHTML = '';

    // 当查询为空时显示全部数据
    const allItems = [
        ...Object.keys(lootData),
        ...Object.keys(itemSourceMap).filter(i => !lootData[i]) // 排除重复的怪物名称
    ].filter((v, i, a) => a.indexOf(v) === i);

    const matches = query ? 
        allItems.filter(item => item.toLowerCase().includes(query)) : 
        allItems;

    list.innerHTML = matches.map(item => `
        <div class="autocomplete-item" onclick="selectSuggestion('${item}')">
            ${lootData[item] ? '怪物：' : '物品：'}${item}
        </div>
    `).join('');

    list.style.display = 'none';
    list.offsetHeight; // 触发重绘
    list.style.display = matches.length ? 'block' : 'none';
}


// 点击搜索栏显示全部怪物
function showAllMonsters() {
    const list = document.getElementById('autocompleteList');
    list.innerHTML = Object.keys(lootData)
        .sort()
        .map(monster => `
            <div class="autocomplete-item" onclick="selectSuggestion('${monster}')">
                怪物：${monster}
            </div>
        `).join('');
    list.style.display = 'block';
}

function selectSuggestion(value) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = value;
    searchInput.dispatchEvent(new Event('input')); // 触发输入事件
    document.getElementById('autocompleteList').style.display = 'none';
    
    // 立即执行搜索
    setTimeout(() => searchData(), 50); // 添加微小延迟确保输入更新
}


// 修改后的tooltip显示
function showTooltip(item, event) {
    const tooltip = document.getElementById('tooltip');
    const dataItem = currentData.find(d => d.item === item);
    if (!dataItem) return;
    
    tooltip.innerHTML = `
        <strong>${item}</strong><br>
        掉落来源：${Array.from(dataItem.monsters)
            .map(m => `<span class="source-tag" style="background:${monsterColors[m]}">${m}</span>`)
            .join(' ')}
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 15}px`;
    tooltip.style.top = `${event.pageY + 15}px`;
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

function searchData() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    currentData.forEach(item => {
        const matchItem = item.item.toLowerCase().includes(query);
        const matchMonster = Array.from(itemSourceMap[item.item] || [])
            .some(m => m.toLowerCase().includes(query));
        item.display = matchItem || matchMonster;
    });
    updateView();
}

function resetView() {
    processRawData();
    document.getElementById('searchInput').value = '';
    updateView();
}

function sortData(column) {
    if (sortState.column === column) {
        sortState.order = (sortState.order + 1) % 3;
    } else {
        sortState.order = 1;
        sortState.column = column;
    }

    currentData.sort((a, b) => {
        const modifier = sortState.order === 2 ? -1 : 1;
        if (column === 'item') {
            return a[column].localeCompare(b[column]) * modifier;
        }
        return (a[column] - b[column]) * modifier;
    });

    if (sortState.order === 0) {
        processRawData();
        sortState.column = null;
    }
    updateView();
}

function updateView() {
    const tbody = document.getElementById('tableBody');
    tbody.style.opacity = 0; // 先隐藏表格
    
    // 使用requestAnimationFrame优化动画
    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        
        currentData.filter(item => item.display).forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.item = item.item;
            row.className = 'sorting-animation';
            row.style.animationDelay = `${index * 0.05}s`; // 行级联动画效果

            row.innerHTML = `
            <td>
                <div>${item.item}</div>
                <div>${Array.from(item.monsters)
                    .map(monster => `<span class="source-tag" style="background:${monsterColors[monster]}">${monster}</span>`)
                    .join('')}
                </div>
            </td>
            <td>
                <div class="progress-container">
                    ${sortState.column === 'price' ? 
                        `<div class="progress-bar" style="width:${(item.price/maxValues.price*100).toFixed(1)}%"></div>` 
                        : ''}
                    <span class="progress-text">${item.price}</span>
                </div>
            </td>
            <td>
                <div class="progress-container">
                    ${sortState.column === 'weight' ? 
                        `<div class="progress-bar" style="width:${(item.weight/maxValues.weight*100).toFixed(1)}%"></div>` 
                        : ''}
                    <span class="progress-text">${item.weight}</span>
                </div>
            </td>
            <td>
                <div class="progress-container">
                    ${sortState.column === 'ppk' ? 
                        `<div class="progress-bar" style="width:${(item.ppk/maxValues.ppk*100).toFixed(1)}%"></div>` 
                        : ''}
                    <span class="progress-text">${item.ppk.toFixed(2)}</span>
                </div>
            </td>
        `;

            tbody.appendChild(row);
        });

        tbody.style.opacity = 1;
        updateSortIndicators();
        
    });
}

// 修改后的排序指示器更新
function updateSortIndicators() {
    document.querySelectorAll('th').forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        const column = th.getAttribute('onclick').match(/'([^']+)'/)[1];
        if (column === sortState.column) {
            indicator.textContent = ['↕', '↑', '↓'][sortState.order];
        } else {
            indicator.textContent = '↕';
        }
    });
}

// 初始化
init();