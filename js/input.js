/* =========================================================
 * js/input.js —— 鼠标 / 触摸输入
 * 只做三件事：把画布点击翻译成棋盘坐标；驱动 Pieces 的选中状态与走子；
 * 走子成功后通知 js/game.js 做胜负判定与回合切换。
 *   点棋子              -> 选中（只能选当前回合方的棋子）
 *   再点同一枚          -> 取消选中
 *   点另一枚            -> 选中转移（己方棋子）
 *   点空白 / 棋盘外     -> 取消选中
 *   已选中时点空格      -> 走法合法才把选中棋子移过去（校验见 js/rules.js）
 *   已选中时点敌方棋子  -> 走法合法才吃掉它（校验见 js/rules.js）
 *   已选中时点己方棋子  -> 选中转移
 * 走子 / 吃子完成后一律取消选中；走法不合法则保持选中，什么都不做。
 * 本阶段只校验走法形状，不做「送将」等限制；回合归属由 js/game.js 管：
 *   未选中任何棋子时，只有点「当前回合方」的棋子才选中，
 *   点对方棋子一律忽略（不选中、不转移），点空点也什么都不做；
 *   已选中时只可能处于「选中方的回合」，所以后续分支不再重复判回合。
 * 走子成功后按顺序处理：先 Game.checkGameOver() 判胜负（吃将），
 * 局面未结束才 Game.switchTurn() —— 顺序不能反，否则吃将那一步会先切回合再弹窗。
 * 游戏一旦结束（Game.isOver() 为 true），本次点击整体忽略 —— 棋盘锁定。
 *
 * 对外暴露：Input.init(canvas, render)
 *   canvas —— 棋盘 canvas
 *   render —— 每次点击处理完后调用，用于整盘重绘
 * ========================================================= */
const Input = (function () {
  'use strict';

  const CELL_SIZE = XIANGQI.CELL_SIZE;
  const MARGIN = XIANGQI.MARGIN;
  const COLS = XIANGQI.COLS;
  const ROWS = XIANGQI.ROWS;
  const CANVAS_WIDTH = XIANGQI.CANVAS_WIDTH;
  const CANVAS_HEIGHT = XIANGQI.CANVAS_HEIGHT;

  /* 命中半径：离最近交叉点超过这个距离就算“点空白”
   * 比棋子半径（约 25.5px）略大，手指点偏一点也能选中 */
  const HIT_RADIUS = CELL_SIZE * 0.5;

  /* ---------------------------------------------------------
   * 1. 屏幕坐标 -> 棋盘逻辑坐标（CSS 像素）
   *    canvas 被 CSS 的 max-width 等比缩小过，高清屏下画布属性尺寸
   *    又被 dpr 放大过，所以不能拿 offsetX / clientX 当逻辑坐标：
   *    必须用 getBoundingClientRect() 的“显示尺寸”求出缩放比，
   *    dpr 缩放也一并被这个比值消化掉。
   * --------------------------------------------------------- */
  function toBoardPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();

    // 显示尺寸为 0（例如元素被隐藏）时提前退出，避免除零
    if (!rect.width || !rect.height) return null;

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  /* ---------------------------------------------------------
   * 2. 逻辑坐标 -> 最近的交叉点 (col, row)
   *    返回 null 表示这次点击算“空白”（棋盘外 / 离交叉点太远）
   * --------------------------------------------------------- */
  function toIntersection(point) {
    if (!point) return null;

    const col = Math.round((point.x - MARGIN) / CELL_SIZE);
    const row = Math.round((point.y - MARGIN) / CELL_SIZE);

    // 不在 9 列 × 10 行的交叉点范围内
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;

    // 离最近交叉点太远 -> 视为点空白
    const dx = point.x - Board.px(col);
    const dy = point.y - Board.py(row);
    if (Math.sqrt(dx * dx + dy * dy) > HIT_RADIUS) return null;

    return { col: col, row: row };
  }

  /* ---------------------------------------------------------
   * 3. 一次点击 -> 更新选中状态（不负责重绘）
   *    未选中时只能选「当前回合方」的棋子；
   *    已选中时该方就是当前回合方，走子 / 吃子 / 取消 / 转移都按原逻辑处理
   * --------------------------------------------------------- */
  function handleClick(canvas, event) {
    // 游戏已结束（已分出胜负）-> 棋盘锁定：点棋子 / 点空白一律无反应
    if (Game.isOver()) return;

    const hit = toIntersection(toBoardPoint(canvas, event));

    // 点空白 / 棋盘外：如果正选中某枚棋子 -> 取消选中
    if (!hit) {
      Pieces.clearSelection();
      return;
    }

    const target = Pieces.findAt(hit.col, hit.row);
    const selected = Pieces.getSelected();

    // 没有选中任何棋子：只有点了「当前回合方」的棋子才选中，
    // 点对方棋子 / 点空点一律什么都不做（不选中，也不发生转移）
    if (!selected) {
      if (target && target.side === Game.getCurrentSide()) {
        Pieces.toggleSelect(target);
      }
      return;
    }

    // 已有选中棋子
    // 点自己 -> 取消选中
    if (target === selected) {
      Pieces.clearSelection();
      return;
    }
    // 点己方另一枚 -> 选中转移
    if (target && target.side === selected.side) {
      Pieces.toggleSelect(target);
      return;
    }
    // 点空点 或 点敌方棋子 -> 先校验走法规则，合法才走子 / 吃子（吃子由 Pieces.move 内部处理）
    if (Rules.canMove(selected, hit.col, hit.row)) {
      const moved = Pieces.move(selected, hit.col, hit.row);

      // 只有真的走成了（返回棋子）才清选中并做胜负检测：
      // 走法被拒时保持选中，方便玩家继续点别的位置；
      // 检测放在走子之后，保证不会“每次点击都检测”。
      if (moved) {
        Pieces.clearSelection();

        // 先判胜负：将 / 帅被吃则立即结束游戏（见 js/game.js）
        // 局面未结束才切换回合 —— 顺序不能反，
        // 否则吃将那一步会先切回合再弹窗，状态栏会闪一下
        if (!Game.checkGameOver()) {
          Game.switchTurn();
        }
      }
    }
    // 走法不合法 -> 什么都不做：保持选中，方便玩家继续点别的位置
  }

  /* ---------------------------------------------------------
   * 4. 绑定事件（本项目唯一绑定点击的地方）
   * --------------------------------------------------------- */
  function init(canvas, render) {
    canvas.addEventListener('click', function (event) {
      handleClick(canvas, event);
      if (typeof render === 'function') render();   // 重绘整盘
    });
  }

  return {
    init: init,
    handleClick: handleClick,       // 便于手动测试 / 后续复用
    toBoardPoint: toBoardPoint,
    toIntersection: toIntersection,
    HIT_RADIUS: HIT_RADIUS
  };
})();
