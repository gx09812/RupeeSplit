 

const tabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view-panel');
const gallery = document.getElementById('gallery');
const addBtn = document.getElementById('addBtn');
const formModal = document.getElementById('formModal');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const galleryForm = document.getElementById('galleryForm');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');

const calcScreen = document.getElementById('calc-screen');
const formulaCache = document.getElementById('formula-cache');
const calcToSplitterBtn = document.getElementById('calc-to-splitter-btn');

const splitTotalInput = document.getElementById('split-total');
const personNameInput = document.getElementById('person-name');
const personUpiInput = document.getElementById('person-upi');
const addPersonBtn = document.getElementById('add-person-btn');
const namesDisplayList = document.getElementById('names-display-list');
const itemTitleInput = document.getElementById('shopping-item-title');
const itemCostInput = document.getElementById('shopping-item-cost');
const addItemBtn = document.getElementById('add-item-btn');
const itemsBreakdownList = document.getElementById('items-breakdown-list');
const perHeadSharesDisplay = document.getElementById('per-head-shares');
const upiLinksContainer = document.getElementById('upi-links-container');

let currentFormula = "";
let peopleList = []; // Array of objects: { id, name, upi, manualAmount, mode: 'auto'|'manual' }
let itemsList = [];   // Array of objects: { title, cost }

// 1. VIEWS NAVIGATION CONTROLLER
tabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const target = tab.getAttribute('data-target');
    
    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active-view'));
    
    tab.classList.add('active');
    document.getElementById(target).classList.add('active-view');
  });
});

//2. RECEIPT VAULT MODULE
addBtn.addEventListener('click', () => formModal.classList.add('active'));
cancelModalBtn.addEventListener('click', () => {
  formModal.classList.remove('active');
  galleryForm.reset();
  fileLabel.innerHTML = `<span class="material-symbols-outlined">upload</span> Snap / Select Bill Photo`;
});

fileInput.addEventListener('change', () => {
  if(fileInput.files.length > 0) {
    fileLabel.innerHTML = `<span class="material-symbols-outlined">check_circle</span> ${fileInput.files[0].name}`;
  }
});

galleryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const storeName = document.getElementById('modalItemName').value;
  const billCost = document.getElementById('modalItemPrice').value;
  
  const file = fileInput.files[0];
  let imageSrc = "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=400"; // default placeholder
  
  if (file) {
    imageSrc = URL.createObjectURL(file);
  }

  const newPad = document.createElement('div');
  newPad.className = 'pad';
  newPad.innerHTML = `
    <div class="imagebox">
      <img src="${imageSrc}" alt="${storeName}" />
    </div>
    <h3>${storeName}</h3>
    <h3>₹ <span>${parseFloat(billCost).toLocaleString('en-IN')}</span></h3>
    <a href="#" class="send-vault-to-splitter" data-amount="${billCost}">Split This Bill</a>
  `;

  gallery.insertBefore(newPad, addBtn);
  
  cancelModalBtn.click();
});

gallery.addEventListener('click', (e) => {
  if(e.target.classList.contains('send-vault-to-splitter')) {
    e.preventDefault();
    const targetAmount = e.target.getAttribute('data-amount');
    transferToSplitter(targetAmount);
  }
});


//  CALCULATOR 
function registerInput(val) {
  if (calcScreen.value === "0" && val !== ".") {
    calcScreen.value = val;
  } else {
    calcScreen.value += val;
  }
  currentFormula += val;
}

function flushEngine() {
  calcScreen.value = "0";
  formulaCache.innerText = "";
  currentFormula = "";
}

function popLastEntry() {
  if(calcScreen.value.length > 1) {
    calcScreen.value = calcScreen.value.slice(0, -1);
  } else {
    calcScreen.value = "0";
  }
}

function applyPercentage() {
  try {
    let expression = calcScreen.value;
    let calculated = eval(expression.replace(/×/g, '*').replace(/÷/g, '/')) / 100;
    calcScreen.value = calculated;
  } catch(err) {
    calcScreen.value = "Error";
  }
}

function executeEvaluation() {
  try {
    let mathExpression = calcScreen.value;
    mathExpression = mathExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    formulaCache.innerText = calcScreen.value + " =";
    let finalOutput = eval(mathExpression);
    calcScreen.value = Number(finalOutput.toFixed(2));
  } catch (error) {
    calcScreen.value = "Error";
  }
}

calcToSplitterBtn.addEventListener('click', () => {
  executeEvaluation();
  const calculatedTotal = calcScreen.value;
  if(calculatedTotal !== "Error" && parseFloat(calculatedTotal) > 0) {
    transferToSplitter(calculatedTotal);
  }
});

function transferToSplitter(amount) {
  splitTotalInput.value = parseFloat(amount);
  const targetTab = document.querySelector('[data-target="splitter-view"]');
  if(targetTab) targetTab.click();
  calculateSplit();
}



splitTotalInput.addEventListener('input', calculateSplit);

addPersonBtn.addEventListener('click', () => {
  const name = personNameInput.value.trim();
  const upi = personUpiInput.value.trim() || "example@upi"; // fallback
  
  if(!name) {
    alert("Please enter a person's name.");
    return;
  }

  const person = {
    id: Date.now() + Math.random(),
    name: name,
    upi: upi,
    manualAmount: 0,
    mode: 'auto' 
  };

  peopleList.push(person);
  personNameInput.value = "";
  personUpiInput.value = "";
  
  renderPeopleList();
  calculateSplit();
});

addItemBtn.addEventListener('click', () => {
  const title = itemTitleInput.value.trim();
  const cost = parseFloat(itemCostInput.value);

  if(!title || isNaN(cost) || cost <= 0) {
    alert("Please enter a valid shopping item name and price.");
    return;
  }

  itemsList.push({ title, cost });
  
  let currentlySetTotal = parseFloat(splitTotalInput.value) || 0;
  splitTotalInput.value = currentlySetTotal + cost;

  itemTitleInput.value = "";
  itemCostInput.value = "";

  renderItemsList();
  calculateSplit();
});

function renderPeopleList() {
  namesDisplayList.innerHTML = "";
  
  peopleList.forEach(person => {
    const li = document.createElement('li');
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.background = "#f4f4f5";
    li.style.padding = "8px 12px";
    li.style.borderRadius = "6px";
    li.style.marginBottom = "5px";

    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = `<strong>${person.name}</strong> <small style="color:#666;">(${person.upi})</small>`;

    const controllerDiv = document.createElement('div');
    controllerDiv.style.display = "flex";
    controllerDiv.style.alignItems = "center";
    controllerDiv.style.gap = "8px";

    const modeBtn = document.createElement('button');
    modeBtn.type = "button";
    modeBtn.innerText = person.mode === 'auto' ? "Auto Split" : "Manual Split";
    modeBtn.style.fontSize = "0.75rem";
    modeBtn.style.padding = "4px 8px";
    modeBtn.style.background = person.mode === 'auto' ? "#22c55e" : "#eab308";
    modeBtn.style.color = "white";
    modeBtn.style.border = "none";
    modeBtn.style.borderRadius = "4px";
    modeBtn.style.cursor = "pointer";
    
    const manualInput = document.createElement('input');
    manualInput.type = "number";
    manualInput.placeholder = "₹ Box";
    manualInput.value = person.manualAmount || "";
    manualInput.style.width = "70px";
    manualInput.style.padding = "2px 4px";
    manualInput.style.display = person.mode === 'manual' ? "block" : "none";

    const delBtn = document.createElement('button');
    delBtn.innerHTML = "&times;";
    delBtn.style.background = "none";
    delBtn.style.color = "red";
    delBtn.style.border = "none";
    delBtn.style.fontWeight = "bold";
    delBtn.style.cursor = "pointer";
    delBtn.style.fontSize = "1.2rem";

    modeBtn.addEventListener('click', () => {
      person.mode = person.mode === 'auto' ? 'manual' : 'auto';
      renderPeopleList();
      calculateSplit();
    });

    manualInput.addEventListener('input', (e) => {
      person.manualAmount = parseFloat(e.target.value) || 0;
      calculateSplit();
    });

    delBtn.addEventListener('click', () => {
      peopleList = peopleList.filter(p => p.id !== person.id);
      renderPeopleList();
      calculateSplit();
    });

    controllerDiv.appendChild(modeBtn);
    controllerDiv.appendChild(manualInput);
    controllerDiv.appendChild(delBtn);
    
    li.appendChild(nameSpan);
    li.appendChild(controllerDiv);
    namesDisplayList.appendChild(li);
  });
}

function renderItemsList() {
  itemsBreakdownList.innerHTML = "";
  itemsList.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${item.title}</span> — <strong>₹${item.cost.toFixed(2)}</strong>`;
    itemsBreakdownList.appendChild(li);
  });
}

function calculateSplit() {
  const baseTotal = parseFloat(splitTotalInput.value) || 0;
  
  if (peopleList.length === 0) {
    perHeadSharesDisplay.innerText = "0.00";
    upiLinksContainer.innerHTML = '<p style="font-size:0.9rem; color:#777;">Add group names or items to view payment shortcuts.</p>';
    return;
  }

  let manualTotal = 0;
  let autoCount = 0;

  peopleList.forEach(p => {
    if (p.mode === 'manual') {
      manualTotal += p.manualAmount;
    } else {
      autoCount++;
    }
  });

  let remainingPool = baseTotal - manualTotal;
  if(remainingPool < 0) remainingPool = 0; 

  let autoSharePerHead = autoCount > 0 ? (remainingPool / autoCount) : 0;
  
  perHeadSharesDisplay.innerText = autoSharePerHead > 0 ? autoSharePerHead.toFixed(2) : (baseTotal / peopleList.length).toFixed(2);

  upiLinksContainer.innerHTML = "";

  peopleList.forEach(p => {
    const shareAmount = p.mode === 'manual' ? p.manualAmount : autoSharePerHead;
    
    if (shareAmount > 0) {
      const linkRow = document.createElement('div');
      linkRow.style.display = "flex";
      linkRow.style.justifyContent = "space-between";
      linkRow.style.alignItems = "center";
      linkRow.style.background = "#fff";
      linkRow.style.border = "1px solid #eee";
      linkRow.style.padding = "10px";
      linkRow.style.borderRadius = "6px";
      linkRow.style.marginBottom = "8px";

      const infoText = document.createElement('span');
      infoText.innerHTML = `🏁 <strong>${p.name}</strong> owes <strong>₹${shareAmount.toFixed(2)}</strong>`;


      const upiString = `upi://pay?pa=${encodeURIComponent(p.upi)}&pn=${encodeURIComponent(p.name)}&am=${shareAmount.toFixed(2)}&cu=INR&tn=RupeeSplit%20Settle`;

      const actionBtn = document.createElement('a');
      actionBtn.href = upiString;
      actionBtn.className = "send-money-btn";
      actionBtn.innerText = "Send Pay Link";
      actionBtn.style.textDecoration = "none";
      actionBtn.style.background = "#4f46e5";
      actionBtn.style.color = "white";
      actionBtn.style.padding = "6px 12px";
      actionBtn.style.borderRadius = "4px";
      actionBtn.style.fontSize = "0.85rem";
      actionBtn.style.fontWeight = "bold";

      linkRow.appendChild(infoText);
      linkRow.appendChild(actionBtn);
      upiLinksContainer.appendChild(linkRow);
    }
  });
}

