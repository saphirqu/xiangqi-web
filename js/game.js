/* =========================================================
 * js/game.js —— 游戏状态机：回合控制 / 胜负判定 / 结束弹窗 / 重新开始
 *
 * 本阶段的胜负条件有两条：
 *   1) 吃掉对方的将 / 帅；
 *   2) 当前回合方投降（由状态栏右侧按钮触发）。
 * 结束游戏统一走内部函数 endGame(winnerSide, reason)，
 * 以后新增其它结束方式时，只要再调一次 endGame 即可，弹窗与状态机不用重写。
 *
 * 回合控制：红方先走（currentSide 初值 'red'）；
 * 输入层在「真的走成一步」且局面未结束时调 switchTurn() 取反，
 * 未选中棋子时点非当前回合方的棋子由输入层直接忽略（见 js/input.js）。
 *
 * 状态栏：#status-turn 显示「轮到红方走 / 轮到黑方走」，
 * #status-surrender 按钮文案同步成「红方投降 / 黑方投降」，
 * 统一由内部函数 updateStatusBar() 刷新，游戏结束后按钮禁用。
 *
 * 对将判负、送将警告等判定依赖进阶系统，本阶段一律不做。
 *
 * 对外暴露：
 *   Game.init(render)      —— 存重绘函数 + 抓弹窗/状态栏 DOM + 绑定「再来一局」「投降」
 *   Game.checkGameOver()   —— 走子后调用；有将/帅被吃则结束游戏并返回 true
 *   Game.isOver()          —— 游戏是否已结束（供输入层锁定棋盘）
 *   Game.getCurrentSide()  —— 当前该谁走：'red' / 'black'
 *   Game.switchTurn()      —— 切换回合并刷新状态栏（已结束则忽略）
 *   Game.surrender()       —— 当前回合方投降，对方获胜（已结束则忽略）
 *   Game.restart()         —— 重置棋局 + 回合归红方 + 关闭弹窗 + 重绘
 * ========================================================= */
const Game = (function () {
  'use strict';

  /* 将 / 帅在 Pieces 里的 type 值（红帅、黑将用的是同一个 type） */
  const JIANG_TYPE = 'jiang';

  /* 是否已分出胜负：true 时输入层应完全忽略点击 */
  let isOver = false;

  /* 当前该谁走：红方先走（'red' / 'black'） */
  let currentSide = 'red';

  /* 重绘函数（由 main.js 的 render 传入） */
  let renderRef = null;

  /* 弹窗相关 DOM 引用（init 时抓取一次） */
  let overlayEl = null;
  let titleEl = null;
  let restartBtnEl = null;

  /* 状态栏相关 DOM 引用（init 时抓取一次） */
  let statusTurnEl = null;
  let statusSurrenderBtnEl = null;

  /* ---------------------------------------------------------
   * 显示 / 隐藏结束弹窗：只切换 .hidden 类，不直接改 style，
   * 样式（遮罩、卡片、按钮）全部交给 css/style.css 管
   * --------------------------------------------------------- */
  function showOverlay(text) {
    if (titleEl) titleEl.textContent = text;
    if (overlayEl) overlayEl.classList.remove('hidden');
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.add('hidden');
  }

  /* ---------------------------------------------------------
   * 刷新状态栏：回合提示文字 + 投降按钮文案 / 可用状态
   * 把状态栏的 DOM 更新集中在一处，调用方（init / switchTurn /
   * surrender / restart / endGame）只管在状态变化后调一次即可。
   * 所有 DOM 引用前先判空，与 showOverlay / hideOverlay 风格一致。
   * --------------------------------------------------------- */
  function updateStatusBar() {
    const sideText = (currentSide === 'red') ? '红方' : '黑方';

    if (statusTurnEl) statusTurnEl.textContent = '轮到' + sideText + '走';

    if (statusSurrenderBtnEl) {
      statusSurrenderBtnEl.textContent = sideText + '投降';
      // 结束后禁用：弹窗其实已经遮住界面点不到，这里只是规范兜底
      statusSurrenderBtnEl.disabled = isOver;
    }
  }

  /* ---------------------------------------------------------
   * 结束游戏（内部通用入口，未来「投降」也复用这里）
   *   winnerSide —— 'red' / 'black'
   *   reason     —— '吃将' / '投降'（仅用于说明触发来源）
   * 目前 reason 只用于说明触发来源，文案统一按「X方获胜」展示；
   * 以后需要区分文案时，在这里按 reason 分支即可。
   * --------------------------------------------------------- */
  function endGame(winnerSide, reason) {
    if (isOver) return;                     // 已经结束过就直接忽略，避免重复弹窗

    isOver = true;
    showOverlay((winnerSide === 'red' ? '红方' : '黑方') + '获胜');

    updateStatusBar();   // 结束后把投降按钮置为 disabled（弹窗已遮住界面，这里只作规范兜底）
  }

  /* ---------------------------------------------------------
   * 查某一方是否还有将 / 帅
   * 直接遍历 Pieces.pieces（不依赖 Rules 的内部实现）
   * --------------------------------------------------------- */
  function hasJiang(side) {
    const list = Pieces.pieces;

    for (let i = 0; i < list.length; i++) {
      if (list[i].side === side && list[i].type === JIANG_TYPE) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------
   * 走子后检测胜负
   *   双方将/帅都在     -> 游戏继续，返回 false
   *   红帅被吃          -> 黑方获胜
   *   黑将被吃          -> 红方获胜
   * 返回 true 表示游戏已结束
   * --------------------------------------------------------- */
  function checkGameOver() {
    if (isOver) return true;

    const redAlive = hasJiang('red');
    const blackAlive = hasJiang('black');

    if (redAlive && blackAlive) return false;

    // 只有一方还有将/帅 -> 另一方获胜（双方都不在属于异常情况，按红帅不在处理）
    endGame(redAlive ? 'red' : 'black', '吃将');

    return true;
  }

  /* 读状态（函数名不能和上面的私有变量 isOver 同名，故用 isGameOver） */
  function isGameOver() {
    return isOver;
  }

  /* 读当前回合方（'red' / 'black'），供输入层判断该谁能被选中 */
  function getCurrentSide() {
    return currentSide;
  }

  /* ---------------------------------------------------------
   * 切换回合：只有「真的走成了一步」之后才由输入层调用
   * 游戏已结束则直接忽略（避免结束后状态栏还被切换）
   * --------------------------------------------------------- */
  function switchTurn() {
    if (isOver) return;

    currentSide = (currentSide === 'red') ? 'black' : 'red';
    updateStatusBar();
  }

  /* ---------------------------------------------------------
   * 投降：当前回合方认输、对方获胜，复用 endGame 弹窗
   * 二次确认（window.confirm）由调用方——状态栏按钮的点击回调负责，
   * 这里只管状态变更，方便以后换别的确认方式。
   * --------------------------------------------------------- */
  function surrender() {
    if (isOver) return;

    endGame(currentSide === 'red' ? 'black' : 'red', '投降');
  }

  /* ---------------------------------------------------------
   * 重新开始：棋子回初始布局、关弹窗、解除锁定、重绘
   * --------------------------------------------------------- */
  function restart() {
    Pieces.reset();
    hideOverlay();
    isOver = false;
    currentSide = 'red';        // 回合重置：新的一局仍由红方先走

    updateStatusBar();          // 状态栏跟着复位（投降按钮也会重新启用）

    if (typeof renderRef === 'function') renderRef();
  }

  /* ---------------------------------------------------------
   * 初始化：存重绘函数 + 抓弹窗/状态栏 DOM + 绑定「再来一局」「投降」
   * --------------------------------------------------------- */
  function init(render) {
    renderRef = (typeof render === 'function') ? render : null;

    overlayEl = document.getElementById('game-over');
    titleEl = document.getElementById('game-over-title');
    restartBtnEl = document.getElementById('game-over-restart');

    // 状态栏：回合提示 + 投降按钮
    statusTurnEl = document.getElementById('status-turn');
    statusSurrenderBtnEl = document.getElementById('status-surrender');

    if (restartBtnEl) {
      restartBtnEl.addEventListener('click', function () {
        restart();
      });
    }

    if (statusSurrenderBtnEl) {
      statusSurrenderBtnEl.addEventListener('click', function () {
        // 二次确认：只有点了「确定」才真的执行投降
        if (window.confirm('确定要投降吗？')) {
          surrender();
        }
      });
    }

    // 兜底：即使 HTML 上漏了 hidden 类，开局也保证弹窗不可见
    hideOverlay();

    updateStatusBar();   // 开局先渲染一次状态栏（回合 + 按钮文案 / 可用状态）
  }

  return {
    init: init,
    checkGameOver: checkGameOver,
    isOver: isGameOver,
    getCurrentSide: getCurrentSide,
    switchTurn: switchTurn,
    surrender: surrender,
    restart: restart
  };
})();
