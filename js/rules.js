/* =========================================================
 * js/rules.js —— 走法规则（只校验走法形状）
 *
 * 对外暴露：
 *   Rules.canMove(piece, col, row) —— 这枚棋子能否按规则走到 (col, row)
 *   Rules.getLegalTargets(piece)   —— 这枚棋子的全部合法落点，[{ col: c, row: r }, ...]
 *
 * 分派方式：按 piece.type 分派（switch），不按 piece.level 分派。
 *   进阶棋子的走法后续再补，这里只覆盖 7 种基础 type：
 *   che / ma / xiang / shi / jiang / pao / bing
 *   未知 type 一律返回 false。
 * 所有私有走法函数签名统一为 (piece, toCol, toRow)，传整个 piece 对象。
 *
 * 本阶段只校验“走法形状”，不做这些校验（留给后续步骤）：
 *   - 目标点是否为己方棋子（由 input.js 的选中转移与 Pieces.move 处理）
 *   - 送将、将帅对面
 *   - 回合控制、胜负判定
 *
 * 依赖：XIANGQI（constants.js）、Pieces（pieces.js）。
 *   Pieces 只在函数被调用时访问，所以加载顺序放在 pieces.js 之前也没问题。
 * ========================================================= */
const Rules = (function () {
  'use strict';

  /* ---------------- 从 constants.js 取常量，不硬编码行号 / 列号 ---------------- */
  const COLS = XIANGQI.COLS;
  const ROWS = XIANGQI.ROWS;
  const RIVER_TOP_ROW = XIANGQI.RIVER_TOP_ROW;            // 4：河界上沿
  const RIVER_BOTTOM_ROW = XIANGQI.RIVER_BOTTOM_ROW;      // 5：河界下沿
  const PALACE_LEFT_COL = XIANGQI.PALACE_LEFT_COL;        // 3
  const PALACE_RIGHT_COL = XIANGQI.PALACE_RIGHT_COL;      // 5
  const BLACK_PALACE_TOP_ROW = XIANGQI.BLACK_PALACE_TOP_ROW;      // 0
  const RED_PALACE_BOTTOM_ROW = XIANGQI.RED_PALACE_BOTTOM_ROW;    // 9

  /* constants.js 只给出九宫的“外沿”（黑方上沿 / 红方下沿），
   * 九宫的另一侧边界与棋盘上下边界在这里补齐成具名常量，
   * 免得判断里到处出现裸数字（board.js 画九宫斜线时同样是跨 2 行）。 */
  const PALACE_ROW_SPAN = 2;                                              // 九宫纵向跨 2 行（共 3 行）
  const BLACK_PALACE_BOTTOM_ROW = BLACK_PALACE_TOP_ROW + PALACE_ROW_SPAN;  // 2
  const RED_PALACE_TOP_ROW = RED_PALACE_BOTTOM_ROW - PALACE_ROW_SPAN;      // 7

  const BOARD_TOP_ROW = 0;             // 棋盘最上行（黑方底线）
  const BOARD_BOTTOM_ROW = ROWS - 1;   // 棋盘最下行（红方底线）

  /* =========================================================
   * 通用小工具
   * ========================================================= */

  /* 是否在棋盘范围内 */
  function isInside(col, row) {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  /* 是否落在己方九宫内（九宫 = col 3~5 的 3×3 区域） */
  function isInPalace(side, col, row) {
    if (col < PALACE_LEFT_COL || col > PALACE_RIGHT_COL) return false;

    if (side === 'black') {
      return row >= BLACK_PALACE_TOP_ROW && row <= BLACK_PALACE_BOTTOM_ROW;
    }
    return row >= RED_PALACE_TOP_ROW && row <= RED_PALACE_BOTTOM_ROW;
  }

  /* 是否属于“同行或同列”的直线走法（含原地不动，原地由 canMove 拦掉） */
  function isStraightMove(fromCol, fromRow, toCol, toRow) {
    return fromCol === toCol || fromRow === toRow;
  }

  /* 统计起止点之间（不含两端）的棋子数量。
   * 只用于同行 / 同列的直线，步长由起止点之差的正负号决定。 */
  function countBetween(fromCol, fromRow, toCol, toRow) {
    let count = 0;

    const stepCol = Math.sign(toCol - fromCol);
    const stepRow = Math.sign(toRow - fromRow);

    let col = fromCol + stepCol;
    let row = fromRow + stepRow;

    while (col !== toCol || row !== toRow) {
      if (Pieces.findAt(col, row)) count++;
      col += stepCol;
      row += stepRow;
    }

    return count;
  }

  /* =========================================================
   * 各棋子走法：签名统一为 (piece, toCol, toRow)
   * 这些函数只管“形状”，不管目标点是谁的棋子
   * ========================================================= */

  /* 车：直线横走 / 竖走，路径上不能有任何棋子阻挡 */
  function canCheMove(piece, toCol, toRow) {
    if (!isStraightMove(piece.col, piece.row, toCol, toRow)) return false;
    return countBetween(piece.col, piece.row, toCol, toRow) === 0;
  }

  /* 马：走「日」字（2 + 1 格），蹩马腿则不能走 */
  function canMaMove(piece, toCol, toRow) {
    const dc = toCol - piece.col;
    const dr = toRow - piece.row;
    const adc = Math.abs(dc);
    const adr = Math.abs(dr);

    if (!((adc === 2 && adr === 1) || (adc === 1 && adr === 2))) return false;

    // 马腿 = 先直走的那一格（横向 2 格时在横向，纵向 2 格时在纵向）
    const legCol = adc === 2 ? piece.col + Math.sign(dc) : piece.col;
    const legRow = adr === 2 ? piece.row + Math.sign(dr) : piece.row;

    // 马腿上有任意棋子（不论红黑）-> 蹩马腿，不能走
    return !Pieces.findAt(legCol, legRow);
  }

  /* 象 / 相：走「田」字（±2 列 ±2 行），塞象眼不能走，且不能过河 */
  function canXiangMove(piece, toCol, toRow) {
    const dc = toCol - piece.col;
    const dr = toRow - piece.row;

    if (Math.abs(dc) !== 2 || Math.abs(dr) !== 2) return false;

    // 不过河：黑象只在 row 0~4（上方），红相只在 row 5~9（下方）
    if (piece.side === 'black') {
      if (toRow < BOARD_TOP_ROW || toRow > RIVER_TOP_ROW) return false;
    } else {
      if (toRow < RIVER_BOTTOM_ROW || toRow > BOARD_BOTTOM_ROW) return false;
    }

    // 象眼 = 田字中心交叉点（±1 列 ±1 行），有任意棋子就不能走
    const eyeCol = piece.col + dc / 2;
    const eyeRow = piece.row + dr / 2;

    return !Pieces.findAt(eyeCol, eyeRow);
  }

  /* 士 / 仕：斜走一格，且只能在己方九宫内 */
  function canShiMove(piece, toCol, toRow) {
    const dc = Math.abs(toCol - piece.col);
    const dr = Math.abs(toRow - piece.row);

    if (dc !== 1 || dr !== 1) return false;

    return isInPalace(piece.side, toCol, toRow);
  }

  /* 将 / 帅：直走一格，且只能在己方九宫内（将帅对面留给后续步骤） */
  function canJiangMove(piece, toCol, toRow) {
    const dc = Math.abs(toCol - piece.col);
    const dr = Math.abs(toRow - piece.row);

    if (dc + dr !== 1) return false;   // 只允许上下左右一格（斜走 / 原地都不行）

    return isInPalace(piece.side, toCol, toRow);
  }

  /* 炮：目标点为空 -> 走法同车；目标点有棋子 -> 必须隔「恰好一个」棋子（炮架） */
  function canPaoMove(piece, toCol, toRow) {
    if (!isStraightMove(piece.col, piece.row, toCol, toRow)) return false;

    const between = countBetween(piece.col, piece.row, toCol, toRow);
    const target = Pieces.findAt(toCol, toRow);

    // 目标点为空：走法同车，路径上不能有任何棋子
    if (!target) return between === 0;

    // 目标点有棋子（不论红黑）：隔 0 个或 2 个及以上都不能吃，必须恰好隔一个
    return between === 1;
  }

  /* 过河判断：红兵 row <= 4 即已过河；黑卒 row >= 5 即已过河 */
  function isBingPastRiver(piece) {
    if (piece.side === 'black') return piece.row >= RIVER_BOTTOM_ROW;
    return piece.row <= RIVER_TOP_ROW;
  }

  /* 兵 / 卒：未过河只能前进一步；过河后可前进或左右横走一格；永不后退 */
  function canBingMove(piece, toCol, toRow) {
    const dc = toCol - piece.col;
    const dr = toRow - piece.row;

    // 前进方向：红兵 row 减小，黑卒 row 增大
    const forward = piece.side === 'black' ? 1 : -1;

    // 向前走一格（任何阶段都允许）
    if (dc === 0 && dr === forward) return true;

    // 过河后才能左右横走一格
    if (isBingPastRiver(piece) && dr === 0 && Math.abs(dc) === 1) return true;

    return false;
  }

  /* =========================================================
   * 对外入口：按 piece.type 分派（不按 piece.level 分派）
   * ========================================================= */
  function canMove(piece, toCol, toRow) {
    if (!piece) return false;
    if (!isInside(toCol, toRow)) return false;
    if (piece.col === toCol && piece.row === toRow) return false;   // 原地不动不算走子

    switch (piece.type) {
      case 'che':   return canCheMove(piece, toCol, toRow);
      case 'ma':    return canMaMove(piece, toCol, toRow);
      case 'xiang': return canXiangMove(piece, toCol, toRow);
      case 'shi':   return canShiMove(piece, toCol, toRow);
      case 'jiang': return canJiangMove(piece, toCol, toRow);
      case 'pao':   return canPaoMove(piece, toCol, toRow);
      case 'bing':  return canBingMove(piece, toCol, toRow);
      default:      return false;   // 未知 type（含后续的进阶 type）一律不能走
    }
  }

  /* =========================================================
   * 对外入口：列出这枚棋子的全部合法落点
   * 遍历方法：按列优先（col 0~8 外层、row 0~9 内层）扫遍整个棋盘，
   *   每格做三步过滤：
   *     1) 跳过棋子自己所在的那一格（原地不动不算走子）
   *     2) canMove 不合法 -> 跳过（走法形状由各私有走法函数负责）
   *     3) 目标点上是己方棋子 -> 跳过（不能吃自己的子）
   *   剩下的就是合法落点，压入结果数组。
   * 返回：数组，每项形如 { col: c, row: r }；piece 为空时返回空数组。
   * 本阶段依然只校验“走法形状”，不做送将 / 将帅对面校验（留给后续步骤）。
   * ========================================================= */
  function getLegalTargets(piece) {
    const targets = [];

    if (!piece) return targets;

    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        // 1) 自身所在的交叉点不画提示
        if (col === piece.col && row === piece.row) continue;

        // 2) 走法形状不合法
        if (!canMove(piece, col, row)) continue;

        // 3) 目标点上的棋子是己方 -> 不能吃自己的子
        //    （目标点为空、或为敌方棋子都算合法落点）
        const target = Pieces.findAt(col, row);
        if (target && target.side === piece.side) continue;

        targets.push({ col: col, row: row });
      }
    }

    return targets;
  }

  return {
    canMove: canMove,
    getLegalTargets: getLegalTargets
  };
})();
