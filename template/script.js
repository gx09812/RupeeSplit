(function () {
  "use strict";

  const AppState = {
    activeViewId: "vault-view",
    calculator: {
      isResetPending: false
    },
    splitter: {
      friendsPool: [], 
      shoppingItems: [],
      explicitBaseTotal: 0
    },
    garbageCache: new Set() 
  };

  const DOM = {
    tabs: document.querySelectorAll(".nav-tab"),
    views: document.querySelectorAll(".view-panel"),
    calcScreen: document.getElementById("calc-screen"),
    formulaCache: document.getElementById("formula-cache"),
    calcToSplitterBtn: document.getElementById("calc-to-splitter-btn"),
    gallery: document.getElementById("gallery"),
    addBtn: document.getElementById("addBtn"),
    formModal: document.getElementById("formModal"),
    cancelModalBtn: document.getElementById("cancelModalBtn"),
    galleryForm: document.getElementById("galleryForm"),
    fileInput: document.getElementById("fileInput"),
    fileLabel: document.getElementById("fileLabel"),
    splitTotal: document.getElementById("split-total"),
    personName: document.getElementById("person-name"),
    personUpi: document.getElementById("person-upi"),
    addPersonBtn: document.getElementById("add-person-btn"),
    namesDisplayList: document.getElementById("names-display-list"),
    shoppingItemTitle: document.getElementById("shopping-item-title"),
    shoppingItemCost: document.getElementById("shopping-item-cost"),
    addItemBtn: document.getElementById("add-item-btn"),
    itemsBreakdownList: document.getElementById("items-breakdown-list"),
    perHeadShares: document.getElementById("per-head-shares"),
    upiLinksContainer: document.getElementById("upi-links-container"),
    themeToggle: document.getElementById("theme-toggle")
  };

  document.addEventListener("DOMContentLoaded", () => {
    initNavigationRouter();
    initReceiptVault();
    initCalculatorEngine();
    initSplitterEngine();
    initSystemThemes();
  });

  function initNavigationRouter() {
    DOM.tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const target = tab.getAttribute("data-target");
        executeTransitionToView(target);
      });
    });
  }

  function executeTransitionToView(targetId) {
    DOM.tabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-target") === targetId));
    DOM.views.forEach((v) => v.classList.toggle("active-view", v.id === targetId));
    AppState.activeViewId = targetId;
  }

  function initReceiptVault() {
    DOM.gallery.addEventListener("click", (e) => {
      const actionableAnchor = e.target.closest(".send-vault-to-splitter");
      if (actionableAnchor) {
        e.preventDefault();
        const extractedValue = parseFloat(actionableAnchor.getAttribute("data-amount"));
        if (!isNaN(extractedValue)) pipeValueDirectToSplitter(extractedValue);
      }
    });

    DOM.addBtn.addEventListener("click", () => DOM.formModal.style.display = "flex");
    DOM.cancelModalBtn.addEventListener("click", closeVaultModal);
    DOM.formModal.addEventListener("click", (e) => { if (e.target === DOM.formModal) closeVaultModal(); });

    DOM.fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        DOM.fileLabel.innerHTML = `<span class="material-symbols-outlined">check_circle</span> ${sanitizeHtml(e.target.files[0].name)}`;
      }
    });

    DOM.galleryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const storeTitle = DOM.galleryForm.modalItemName.value.trim();
      const rawCost = parseFloat(DOM.galleryForm.modalItemPrice.value);
      const targetFile = DOM.fileInput.files[0];

      if (!storeTitle || isNaN(rawCost)) return;

      let fileSourceUrl = "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=400";
      if (targetFile) {
        fileSourceUrl = URL.createObjectURL(targetFile);
        AppState.garbageCache.add(fileSourceUrl); 
      }

      const generatedPad = document.createElement("div");
      generatedPad.className = "pad";
      generatedPad.innerHTML = `
        <div class="imagebox"><img src="${fileSourceUrl}" alt="${sanitizeHtml(storeTitle)}" loading="lazy" /></div>
        <h3>${sanitizeHtml(storeTitle)}</h3>
        <h3>₹ <span>${rawCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></h3>
        <a href="#" class="send-vault-to-splitter" data-amount="${rawCost}">Split This Bill</a>
      `;

      DOM.gallery.insertBefore(generatedPad, DOM.addBtn);
      closeVaultModal();
    });
  }

  function closeVaultModal() {
    DOM.formModal.style.display = "none";
    DOM.galleryForm.reset();
    DOM.fileLabel.innerHTML = `<span class="material-symbols-outlined">upload</span> Snap / Select Bill Photo`;
  }

  function initCalculatorEngine() {
    window.registerInput = (inputSymbol) => {
      if (AppState.calculator.isResetPending && !["+", "-", "*", "/"].includes(inputSymbol)) {
        DOM.calcScreen.value = "";
      }
      AppState.calculator.isResetPending = false;

      if (DOM.calcScreen.value === "0" && inputSymbol !== ".") {
        DOM.calcScreen.value = inputSymbol;
      } else {
        DOM.calcScreen.value += inputSymbol;
      }
    };

    window.flushEngine = () => {
      DOM.calcScreen.value = "0";
      DOM.formulaCache.innerText = "";
      AppState.calculator.isResetPending = false;
    };

    window.popLastEntry = () => {
      const internalString = DOM.calcScreen.value;
      DOM.calcScreen.value = internalString.length > 1 ? internalString.slice(0, -1) : "0";
    };

    window.applyPercentage = () => {
      const scalarValue = parseFloat(DOM.calcScreen.value);
      if (!isNaN(scalarValue)) {
        DOM.calcScreen.value = financialSafeRound(scalarValue / 100).toString();
      }
    };

    window.executeEvaluation = () => {
      try {
        const structuralExpression = DOM.calcScreen.value.replace(/×/g, "*").replace(/÷/g, "/");
        if (!structuralExpression) return;

        const evaluationOutput = Function(`"use strict"; return (${structuralExpression})`)();

        if (evaluationOutput === Infinity || isNaN(evaluationOutput)) throw new Error("Faulty Operation");

        DOM.formulaCache.innerText = `${DOM.calcScreen.value} =`;
        DOM.calcScreen.value = financialSafeRound(evaluationOutput).toString();
        AppState.calculator.isResetPending = true;
      } catch {
        DOM.calcScreen.value = "Error";
      }
    };

    DOM.calcToSplitterBtn.addEventListener("click", () => {
      if (!AppState.calculator.isResetPending) window.executeEvaluation();
      const outputVal = parseFloat(DOM.calcScreen.value);
      if (!isNaN(outputVal) && outputVal > 0) pipeValueDirectToSplitter(outputVal);
    });
  }

  function pipeValueDirectToSplitter(finalNumericVal) {
    DOM.splitTotal.value = financialSafeRound(finalNumericVal);
    AppState.splitter.explicitBaseTotal = financialSafeRound(finalNumericVal);
    syncAndRecalculateBalances();
    executeTransitionToView("splitter-view");
  }

  function initSplitterEngine() {
    DOM.splitTotal.addEventListener("input", () => {
      AppState.splitter.explicitBaseTotal = parseFloat(DOM.splitTotal.value) || 0;
      syncAndRecalculateBalances();
    });

    DOM.addPersonBtn.addEventListener("click", () => {
      const explicitName = DOM.personName.value.trim();
      const inputUpi = DOM.personUpi.value.trim();

      if (!explicitName) return;

      AppState.splitter.friendsPool.push({ id: crypto.randomUUID(), name: explicitName, upi: inputUpi });
      DOM.personName.value = "";
      DOM.personUpi.value = "";

      refreshGroupListUI();
      syncAndRecalculateBalances();
    });

    DOM.addItemBtn.addEventListener("click", () => {
      const targetLabel = DOM.shoppingItemTitle.value.trim();
      const nominalCost = parseFloat(DOM.shoppingItemCost.value);

      if (!targetLabel || isNaN(nominalCost)) return;

      AppState.splitter.shoppingItems.push({ id: crypto.randomUUID(), title: targetLabel, cost: nominalCost });
      DOM.shoppingItemTitle.value = "";
      DOM.shoppingItemCost.value = "";

      refreshShoppingItemsUI();
      syncAndRecalculateBalances();
    });
  }

  function refreshGroupListUI() {
    DOM.namesDisplayList.innerHTML = "";
    AppState.splitter.friendsPool.forEach((friend) => {
      const itemNode = document.createElement("li");
      itemNode.className = "names-list-item"; 
      itemNode.innerHTML = `
        <span><strong>${sanitizeHtml(friend.name)}</strong> ${friend.upi ? `<small class="upi-text-mute">(${sanitizeHtml(friend.upi)})</small>` : ""}</span>
        <span class="material-symbols-outlined removal-trigger">delete</span>
      `;
      itemNode.querySelector(".removal-trigger").addEventListener("click", () => {
        AppState.splitter.friendsPool = AppState.splitter.friendsPool.filter((f) => f.id !== friend.id);
        refreshGroupListUI();
        syncAndRecalculateBalances();
      });
      DOM.namesDisplayList.appendChild(itemNode);
    });
  }

  function refreshShoppingItemsUI() {
    DOM.itemsBreakdownList.innerHTML = "";
    AppState.splitter.shoppingItems.forEach((item) => {
      const itemRow = document.createElement("li");
      itemRow.className = "items-list-row";
      itemRow.innerHTML = `
        <div class="shopping-item-card">
          <span>${sanitizeHtml(item.title)}</span>
          <span class="shopping-price-display">₹ ${item.cost.toFixed(2)} &nbsp; <strong class="item-removal-trigger">&times;</strong></span>
        </div>
      `;
      itemRow.querySelector(".item-removal-trigger").addEventListener("click", () => {
        AppState.splitter.shoppingItems = AppState.splitter.shoppingItems.filter((i) => i.id !== item.id);
        refreshShoppingItemsUI();
        syncAndRecalculateBalances();
      });
      DOM.itemsBreakdownList.appendChild(itemRow);
    });
  }

  function syncAndRecalculateBalances() {
    const summationOfItems = AppState.splitter.shoppingItems.reduce((acc, item) => acc + item.cost, 0);
    const operatingFinancialPool = AppState.splitter.explicitBaseTotal > 0 ? AppState.splitter.explicitBaseTotal : summationOfItems;
    const individualCount = AppState.splitter.friendsPool.length;

    if (individualCount === 0) {
      DOM.perHeadShares.innerText = "0.00";
      DOM.upiLinksContainer.innerHTML = `<p class="placeholder-text">Add group names or items to view payment shortcuts.</p>`;
      return;
    }

    const dividedShareAmount = financialSafeRound(operatingFinancialPool / individualCount);
    DOM.perHeadShares.innerText = dividedShareAmount.toFixed(2);
    DOM.upiLinksContainer.innerHTML = "";

    AppState.splitter.friendsPool.forEach((friend) => {
      const calibratedVpa = friend.upi ? friend.upi : `${friend.name.replace(/\s+/g, "").toLowerCase()}@upi`;
      const structuredUpiString = `upi://pay?pa=${calibratedVpa}&pn=${encodeURIComponent(friend.name)}&am=${dividedShareAmount.toFixed(2)}&cu=INR`;

      const paymentCardNode = document.createElement("div");
      paymentCardNode.className = "payment-link-card"; 
      paymentCardNode.innerHTML = `
        <div class="payment-card-details">
          <strong class="payment-card-name">${sanitizeHtml(friend.name)}</strong>
          <small class="placeholder-text">Assigned Portion: ₹${dividedShareAmount.toFixed(2)}</small>
        </div>
        <a href="${structuredUpiString}" class="direct-pay-btn">
          <span class="material-symbols-outlined">bolt</span> Direct Pay
        </a>
      `;
      DOM.upiLinksContainer.appendChild(paymentCardNode);
    });
  }

  function initSystemThemes() {
    DOM.themeToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    });
  }

  function financialSafeRound(targetNum) {
    return Math.round((targetNum + Number.EPSILON) * 100) / 100;
  }

  function sanitizeHtml(dirtyString) {
    return dirtyString
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.addEventListener("beforeunload", () => {
    AppState.garbageCache.forEach((allocatedBlobUrl) => URL.revokeObjectURL(allocatedBlobUrl));
  });
})();