/* =========================================================
 * js/constants.js —— 棋盘规格与配色常量
 * 全局只暴露一个 XIANGQI 对象，其它模块从这里取值。
 * ========================================================= */
const XIANGQI = (function () {
  'use strict';

  /* ---------------- 棋盘规格 ----------------
   * 中国象棋棋盘：9 条竖线（9 列交叉点）× 10 条横线（10 行交叉点）
   * 列号 col: 0 ~ 8 从左到右
   * 行号 row: 0 ~ 9 从上到下（row 0 为黑方底线，row 9 为红方底线）
   */
  const COLS = 9;
  const ROWS = 10;

  /* ---------------- 像素尺寸 ---------------- */
  const CELL_SIZE = 60;                            // 相邻交叉点的间距
  const MARGIN = 46;                               // 棋盘四周留白（含外框装饰空间）

  const BOARD_WIDTH = (COLS - 1) * CELL_SIZE;      // 网格区宽 = 8 格 = 480
  const BOARD_HEIGHT = (ROWS - 1) * CELL_SIZE;     // 网格区高 = 9 格 = 540

  const CANVAS_WIDTH = BOARD_WIDTH + MARGIN * 2;   // 560
  const CANVAS_HEIGHT = BOARD_HEIGHT + MARGIN * 2; // 620

  /* ---------------- 关键行号 / 列号 ----------------
   * 楚河汉界位于 row 4 与 row 5 之间
   * 九宫位于 col 3 ~ 5 的 3×3 区域
   */
  const RIVER_TOP_ROW = 4;      // 河界上沿所在的行
  const RIVER_BOTTOM_ROW = 5;    // 河界下沿所在的行
  const PALACE_LEFT_COL = 3;
  const PALACE_RIGHT_COL = 5;
  const BLACK_PALACE_TOP_ROW = 0;    // 黑方九宫（上方）
  const RED_PALACE_BOTTOM_ROW = 9;   // 红方九宫（下方）

  /* ---------------- 配色 ---------------- */
  const COLORS = {
    background: '#f3d9a4',   // 棋盘底色（米黄木质）
    line: '#6b4423',         // 网格 / 九宫 / 角标线
    frame: '#6b4423',        // 外框装饰线
    riverText: '#6b4423'     // “楚河 / 汉界”文字
  };

  return {
    COLS: COLS,
    ROWS: ROWS,
    CELL_SIZE: CELL_SIZE,
    MARGIN: MARGIN,
    BOARD_WIDTH: BOARD_WIDTH,
    BOARD_HEIGHT: BOARD_HEIGHT,
    CANVAS_WIDTH: CANVAS_WIDTH,
    CANVAS_HEIGHT: CANVAS_HEIGHT,
    RIVER_TOP_ROW: RIVER_TOP_ROW,
    RIVER_BOTTOM_ROW: RIVER_BOTTOM_ROW,
    PALACE_LEFT_COL: PALACE_LEFT_COL,
    PALACE_RIGHT_COL: PALACE_RIGHT_COL,
    BLACK_PALACE_TOP_ROW: BLACK_PALACE_TOP_ROW,
    RED_PALACE_BOTTOM_ROW: RED_PALACE_BOTTOM_ROW,
    COLORS: COLORS
  };
})();
