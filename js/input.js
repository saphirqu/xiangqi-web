/* =========================================================
 * js/input.js —— 鼠标 / 触摸输入
 * 只做两件事：把画布点击翻译成棋盘坐标；驱动 Pieces 的选中状态与走子。
 *   点棋子              -> 选中
 *   再点同一枚          -> 取消选中
 *   点另一枚            -> 选中转移
 *   点空白 / 棋盘外     -> 取消选中
 *   已选中时点空格      -> 把选中棋子移过去（不校验规则）
 *   已选中时点敌方棋子  -> 吃掉它再把选中棋子移过去
 *   已选中时点己方棋子  -> 选中转移
 * 走子 / 吃子完成后一律取消选中。
 * 本阶段不校验走子规则、不做回合控制、不做胜负判定（后续再加）。
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
   *    本阶段不区分红黑回合，双方棋子都可选
   * --------------------------------------------------------- */
  function handleClick(canvas, event) {
    const hit = toIntersection(toBoardPoint(canvas, event));

    // 点空白 / 棋盘外：如果正选中某枚棋子 -> 取消选中
    if (!hit) {
      Pieces.clearSelection();
      return;
    }

    const target = Pieces.findAt(hit.col, hit.row);
    const selected = Pieces.getSelected();

    // 没有选中任何棋子
    if (!selected) {
      if (target) Pieces.toggleSelect(target);   // 点棋子 -> 选中
      return;                                    // 点空点 -> 什么都不做
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
    // 点空点 或 点敌方棋子 -> 走子 / 吃子（吃子由 Pieces.move 内部处理）
    Pieces.move(selected, hit.col, hit.row);
    Pieces.clearSelection();
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
