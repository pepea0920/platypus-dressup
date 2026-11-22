"use strict";

const PRICE = 500;
const STORAGE_KEY = "platypus-dressup-v1";
const CHARACTER = "./assets/character.png";
const categories = {
  outfits: {
    layer: 10,
    prefix: "outfit",
    names: ["딸기 리본 드레스", "별빛 세일러복", "크림 리본 카디건", "라벤더 프릴 드레스", "체크 케이프 드레스", "보랏빛 리본 망토"]
  },
  accessories: {
    layer: 30,
    prefix: "accessory",
    sixthFile: "무제778_20261123042912.png",
    names: ["별빛 박쥐 날개", "레이스 장식 리본", "별 장식 안경", "분홍 토끼 귀", "체크 베레모", "토끼 목도리"]
  },
  makeup: {
    layer: 20,
    prefix: "makeup",
    sixthFile: "makeup_07.png",
    names: ["반짝 꽃빛 볼터치", "보랏빛 아이섀도", "하트 볼터치", "꽃잎 속눈썹", "분홍 반창고", "별빛 스티커"]
  }
};

// The thumbnail window frames each sprite's transparent padding.
// These rectangles never affect a worn sprite or modify its PNG.
const thumbnailFrames = {
  outfits: [[10, 625, 1035, 1250], [0, 650, 1065, 1260], [15, 650, 1055, 1255], [25, 650, 1040, 1185], [30, 650, 1050, 1185], [15, 640, 1055, 1185]],
  accessories: [[250, 175, 850, 440], [245, 200, 630, 555], [245, 425, 830, 800], [255, 0, 845, 570], [215, 65, 830, 680], [180, 630, 910, 1180]],
  makeup: [[250, 230, 830, 735], [255, 230, 830, 740], [235, 210, 845, 735], [245, 225, 835, 740], [245, 205, 845, 735], [245, 230, 825, 745]]
};

const itemsByCategory = Object.fromEntries(Object.entries(categories).map(([category, settings]) => [
  category,
  settings.names.map((name, index) => {
    const id = settings.prefix + "_" + String(index + 1).padStart(2, "0");
    const filename = (index === 5 && settings.sixthFile) || id + ".png";
    return { id, category, name, src: "./assets/" + category + "/" + filename, free: index < 2, frame: thumbnailFrames[category][index] };
  })
]));
const catalog = new Map(Object.values(itemsByCategory).flat().map(item => [item.id, item]));
const reviews = [
  "이런 패션은 처음 봅니다. 여러 의미로요.",
  "심사위원들이 아직도 토론 중입니다.",
  "오리너구리 패션계의 새로운 전설이 탄생했습니다!",
  "옷이 오리너구리를 입은 건가요?",
  "오늘의 런웨이는 당신의 것입니다.",
  "이 코디… 300년 뒤에 유행할지도?",
  "심사위원 전원이 할 말을 잃었습니다.",
  "이 오리너구리, 패션을 좀 아는군요!",
  "독창성만큼은 우주 최고!",
  "이 조합은 대체 어떻게 생각해 낸 거죠?",
  "연못 건너편에서도 이 코디가 보였어요.",
  "부리와의 조화에 대해 토론이 길어졌습니다.",
  "심사위원 한 명이 리본을 어디서 샀는지 묻네요.",
  "거울 앞에서 한 바퀴 더 돌아 주세요!",
  "패션 잡지에 연못 특집을 신설하겠습니다.",
  "이 코디가 등장하자 커튼에 달린 별도 흔들렸어요."
];
const reactions = [
  { max: 30, animation: "sad", label: "시무룩", symbols: ["⋯", "·"] },
  { max: 60, animation: "puzzled", label: "어리둥절", symbols: ["?", "✧"] },
  { max: 80, animation: "happy", label: "방긋!", symbols: ["♡", "✦"] },
  { max: 100, animation: "joy", label: "아주 신나요!", symbols: ["★", "♥", "✦"] }
];

const get = id => document.getElementById(id);
const tabs = [...document.querySelectorAll(".tabs button")];
const grid = get("items");
const character = get("character");
const coins = get("coins");
const wallet = coins.closest(".wallet");
const preview = get("preview");
const results = get("results");
const evaluate = get("evaluate");
const buy = get("buy");
const confirm = get("confirm");
const resultClose = results.querySelector(".close");
const missingImages = new Set();
const number = new Intl.NumberFormat("ko-KR");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let activeCategory = "outfits";
let previewItem = null;
let evaluating = false;
let judging = false;
let reactionTimeout;
const state = loadState();

function loadState() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // An empty or invalid save starts a fresh game.
  }

  const coins = Number.isSafeInteger(saved?.coins) && saved.coins >= 0 ? saved.coins : 0;
  const unlocked = new Set([...catalog.values()].filter(item => item.free).map(item => item.id));
  if (Array.isArray(saved?.unlocked)) {
    for (const id of saved.unlocked) {
      if (catalog.has(id)) unlocked.add(id);
    }
  }

  const equipped = {};
  for (const category of Object.keys(categories)) {
    const id = saved?.equipped?.[category];
    if (unlocked.has(id) && catalog.get(id).category === category) equipped[category] = id;
  }
  return { coins, unlocked, equipped };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      coins: state.coins,
      unlocked: [...state.unlocked],
      equipped: state.equipped
    }));
  } catch {
    const warning = get("storage-warning");
    warning.textContent = "브라우저에 저장할 수 없어요. 이 페이지를 닫으면 진행 상황이 사라질 수 있어요.";
    warning.hidden = false;
  }
}

function reportImageError(src) {
  missingImages.add(src);
  const warning = get("asset-warning");
  warning.textContent = "이미지를 불러올 수 없어요. " + [...missingImages].join(", ");
  warning.hidden = false;
}

function sprite(src) {
  const image = new Image();
  image.alt = "";
  image.draggable = false;
  image.addEventListener("error", () => {
    image.hidden = true;
    reportImageError(src);
    if (image.parentElement?.classList.contains("art-frame")) {
      const label = document.createElement("span");
      label.className = "missing";
      label.textContent = "이미지 없음";
      image.parentElement.append(label);
    }
  }, { once: true });
  image.src = src;
  return image;
}

function drawCharacter(target, equipped) {
  const layers = [sprite(CHARACTER)];
  for (const id of Object.values(equipped)) {
    const item = catalog.get(id);
    const layer = sprite(item.src);
    layer.style.zIndex = item.layer ?? categories[item.category].layer;
    layers.push(layer);
  }
  target.replaceChildren(...layers);
}

function thumbnail(item) {
  const [left, top, right, bottom] = item.frame;
  const width = right - left;
  const height = bottom - top;
  const frame = document.createElement("span");
  frame.className = "art-frame";
  frame.style.aspectRatio = width + " / " + height;
  frame.style.width = "min(95cqw, " + (88 * width / height) + "cqh)";

  const image = sprite(item.src);
  image.style.width = (1080 / width * 100) + "%";
  image.style.height = (1300 / height * 100) + "%";
  image.style.left = (-left / width * 100) + "%";
  image.style.top = (-top / height * 100) + "%";
  frame.append(image);
  return frame;
}

function renderCards(fade = false, focusId) {
  const cards = itemsByCategory[activeCategory].map(item => {
    const unlocked = state.unlocked.has(item.id);
    const equipped = state.equipped[activeCategory] === item.id;
    const card = document.createElement("button");
    card.className = unlocked ? "card" : "card locked";
    card.type = "button";
    card.dataset.item = item.id;
    if (unlocked) {
      card.setAttribute("aria-pressed", equipped);
    } else {
      card.setAttribute("aria-label", item.name + ", 잠김, 500코인, 미리보기");
      card.setAttribute("aria-haspopup", "dialog");
    }

    const art = document.createElement("span");
    art.className = "art";
    art.append(thumbnail(item));
    const label = document.createElement("span");
    label.className = "item-name";
    label.textContent = item.name;
    card.append(art, label);

    if (!unlocked || equipped) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = equipped ? "✓" : "🔒";
      card.append(badge);
    }
    if (!unlocked) {
      const price = document.createElement("span");
      price.className = "price";
      price.textContent = "500";
      card.append(price);
    }
    return card;
  });
  grid.replaceChildren(...cards);
  if (fade) animateClass(grid, "fade");
  if (focusId) cards.find(card => card.dataset.item === focusId)?.focus();
}

function selectCategory(tab) {
  if (evaluating || tab.dataset.category === activeCategory) return;
  activeCategory = tab.dataset.category;
  for (const button of tabs) {
    const selected = button === tab;
    button.setAttribute("aria-selected", selected);
    button.tabIndex = selected ? 0 : -1;
  }
  grid.setAttribute("aria-labelledby", tab.id);
  renderCards(true);
}

function animateClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function sparkles(symbols, count = 7) {
  if (reducedMotion.matches) return;
  const effects = get("effects");
  const particles = Array.from({ length: count }, (_, index) => {
    const particle = document.createElement("span");
    const angle = index * 2 * Math.PI / count;
    particle.className = "particle";
    particle.textContent = symbols[index % symbols.length];
    particle.style.setProperty("--x", (Math.cos(angle) * 105) + "px");
    particle.style.setProperty("--y", (Math.sin(angle) * 90) + "px");
    return particle;
  });
  effects.replaceChildren(...particles);
  setTimeout(() => particles.forEach(particle => particle.remove()), 850);
}

function equip(item, purchased = false) {
  if (state.equipped[item.category] === item.id && !purchased) {
    delete state.equipped[item.category];
    get("announcement").textContent = item.name + " 해제";
  } else {
    state.equipped[item.category] = item.id;
    sparkles(purchased ? ["★", "♥", "✦"] : ["✧", "✦"], purchased ? 11 : 7);
    get("announcement").textContent = item.name + (purchased ? " 해금 및 착용" : " 착용");
  }
  save();
  drawCharacter(character, state.equipped);
  renderCards(false, item.id);
}

function showPreview(item) {
  previewItem = item;
  get("preview-name").textContent = item.name;
  get("preview-coins").textContent = number.format(state.coins) + "코인";
  const missing = Math.max(0, PRICE - state.coins);
  get("purchase-message").textContent = missing ? number.format(missing) + "코인이 더 필요해요." : "";
  buy.disabled = missing > 0;
  drawCharacter(get("preview-character"), { ...state.equipped, [item.category]: item.id });
  preview.showModal();
}

function purchase() {
  const item = previewItem;
  if (!preview.open || !item || state.unlocked.has(item.id) || state.coins < PRICE) return;
  state.coins -= PRICE;
  state.unlocked.add(item.id);
  coins.textContent = number.format(state.coins);
  preview.close();
  equip(item, true);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function animateCoins(from, to) {
  wallet.classList.add("earning");
  const start = performance.now();
  return new Promise(resolve => {
    function frame(now) {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (now - start) / 620);
      coins.textContent = number.format(Math.round(from + (to - from) * progress));
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        wallet.classList.remove("earning");
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

async function playEvaluation() {
  if (evaluating || preview.open || results.open) return;
  evaluating = true;
  judging = true;
  evaluate.disabled = true;

  const score = Math.floor(Math.random() * 101);
  const review = reviews[Math.floor(Math.random() * reviews.length)];
  const starCount = Math.max(1, Math.ceil(score / 20));
  const reaction = reactions.find(entry => score <= entry.max);
  const reactionLabel = get("reaction");
  const resultCharacter = get("result-character");
  const scoreDisplay = get("result-score");
  const stars = get("stars");
  const reviewDisplay = get("review");
  const rewardDisplay = get("reward");
  const title = get("result-title");
  const motion = !reducedMotion.matches;

  clearTimeout(reactionTimeout);
  reactionLabel.hidden = true;
  character.classList.remove(...reactions.map(entry => entry.animation));
  animateClass(character, "judging");
  sparkles(["★", "✧"], 9);

  title.textContent = "코디 평가 중";
  scoreDisplay.textContent = "0점";
  stars.replaceChildren();
  stars.setAttribute("aria-label", "별점 집계 중");
  reviewDisplay.textContent = "";
  rewardDisplay.textContent = "";
  confirm.disabled = true;
  resultClose.hidden = true;
  resultCharacter.classList.remove(...reactions.map(entry => entry.animation));
  drawCharacter(resultCharacter, state.equipped);

  if (motion) await delay(540);
  results.showModal();
  for (let index = 0; index < 20 && motion; index += 1) {
    scoreDisplay.textContent = ((index * 37 + 13) % 101) + "점";
    await delay(52);
  }

  scoreDisplay.textContent = score + "점";
  for (let index = 0; index < 5; index += 1) {
    const star = document.createElement("span");
    star.textContent = index < starCount ? "★" : "☆";
    star.setAttribute("aria-hidden", "true");
    stars.append(star);
    if (motion) await delay(100);
  }

  stars.setAttribute("aria-label", "별 5개 중 " + starCount + "개");
  title.textContent = "코디 평가 결과 · " + score + "점";
  reviewDisplay.textContent = "“" + review + "”";
  const reward = score * 10;
  const previous = state.coins;
  state.coins += reward;
  save();
  rewardDisplay.textContent = number.format(reward) + "코인 획득 · " + reaction.label;
  animateClass(resultCharacter, reaction.animation);
  await animateCoins(previous, state.coins);

  judging = false;
  resultClose.hidden = false;
  confirm.disabled = false;
  confirm.focus();
  results.addEventListener("close", () => {
    character.classList.remove("judging");
    animateClass(character, reaction.animation);
    reactionLabel.textContent = reaction.label;
    reactionLabel.hidden = false;
    sparkles(reaction.symbols, reaction.animation === "joy" ? 12 : 5);
    reactionTimeout = setTimeout(() => { reactionLabel.hidden = true; }, 2200);
    evaluating = false;
    evaluate.disabled = false;
    evaluate.focus();
  }, { once: true });
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectCategory(tab));
  tab.addEventListener("keydown", event => {
    const index = tabs.indexOf(tab);
    const destinations = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    const next = tabs[(destinations[event.key] + tabs.length) % tabs.length];
    selectCategory(next);
    next.focus();
  });
}

grid.addEventListener("click", event => {
  const card = event.target.closest(".card");
  if (!card || evaluating || preview.open) return;
  const item = catalog.get(card.dataset.item);
  if (state.unlocked.has(item.id)) equip(item);
  else showPreview(item);
});
for (const dialog of [preview, results]) {
  for (const button of dialog.querySelectorAll("[data-close]")) {
    button.addEventListener("click", () => dialog.close());
  }
}
preview.addEventListener("close", () => { previewItem = null; });
results.addEventListener("cancel", event => {
  if (judging) event.preventDefault();
});
buy.addEventListener("click", purchase);
evaluate.addEventListener("click", playEvaluation);

const room = document.querySelector(".room");
room.addEventListener("error", () => {
  room.hidden = true;
  reportImageError("./assets/background.png");
}, { once: true });
if (room.complete && !room.naturalWidth) {
  room.hidden = true;
  reportImageError("./assets/background.png");
}
coins.textContent = number.format(state.coins);
drawCharacter(character, state.equipped);
renderCards();
