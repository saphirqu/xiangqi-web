/* =========================================================
 * js/game.js —— 游戏状态机：胜负判定 / 结束弹窗 / 重新开始
 *
 * 本阶段采用的胜负规则只有一条：吃掉对方的将 / 帅即胜。
 * 结束游戏统一走内部函数 endGame(winnerSide, reason)，
 * 以后新增「投降」等结束方式时，只要再调一次 endGame 即可，
 * 弹窗与状态机不用重写（本次不实现投降）。
 *
 * 对将判负、送将警告、二次确认等判定依赖进阶系统，本阶段一律不做。
 *
 * 对外暴露：
 *   Game.init(render)      —— 存下重绘函数、抓取弹窗 DOM、绑定「再来一局」
 *   Game.checkGameOver()   —— 走子后调用；有将/帅被吃则结束游戏并返回 true
 *   Game.isOver()          —— 游戏是否已结束（供输入层锁定棋盘）
 *   Game.restart()         —— 重置棋局 + 关闭弹窗 + 重绘
 * ========================================================= */
const Game = (function () {
  'use strict';

  /* 将 / 帅在 Pieces 里的 type 值（红帅、黑将用的是同一个 type） */
  const JIANG_TYPE = 'jiang';

  /* 是否已分出胜负：true 时输入层应完全忽略点击 */
  let isOver = false;

  /* 重绘函数（由 main.js 的 render 传入） */
  let renderRef = null;

  /* 弹窗相关 DOM 引用（init 时抓取一次） */
  let overlayEl = null;
  let titleEl = null;
  let restartBtnEl = null;

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
   * 结束游戏（内部通用入口，未来「投降」也复用这里）
   *   winnerSide —— 'red' / 'black'
   *   reason     —— '吃将'（以后可能出现 '投降' 等）
   * 目前 reason 只用于说明触发来源，文案统一按「X方获胜」展示；
   * 以后需要区分文案时，在这里按 reason 分支即可。
   * --------------------------------------------------------- */
  function endGame(winnerSide, reason) {
    if (isOver) return;                     // 已经结束过就直接忽略，避免重复弹窗

    isOver = true;
    showOverlay((winnerSide === 'red' ? '红方' : '黑方') + '获胜');
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

  /* ---------------------------------------------------------
   * 重新开始：棋子回初始布局、关弹窗、解除锁定、重绘
   * --------------------------------------------------------- */
  function restart() {
    Pieces.reset();
    hideOverlay();
    isOver = false;

    if (typeof renderRef === 'function') renderRef();
  }

  /* ---------------------------------------------------------
   * 初始化：存重绘函数 + 抓 DOM + 绑定「再来一局」
   * --------------------------------------------------------- */
  function init(render) {
    renderRef = (typeof render === 'function') ? render : null;

    overlayEl = document.getElementById('game-over');
    titleEl = document.getElementById('game-over-title');
    restartBtnEl = document.getElementById('game-over-restart');

    if (restartBtnEl) {
      restartBtnEl.addEventListener('click', function () {
        restart();
      });
    }

    // 兜底：即使 HTML 上漏了 hidden 类，开局也保证弹窗不可见
    hideOverlay();
  }

  return {
    init: init,
    checkGameOver: checkGameOver,
    isOver: isGameOver,
    restart: restart
  };
})();
