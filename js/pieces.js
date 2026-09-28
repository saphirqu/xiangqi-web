/* =========================================================
 * js/pieces.js —— 棋子数据与绘制
 * 只负责“把棋子摆到棋盘上”，不包含任何交互：
 * 不能点击、不能选中、不能走子。
 *
 * 对外暴露：
 *   Pieces.pieces            —— 棋子对象数组（含 id/side/type/col/row/level）
 *   Pieces.drawAll(ctx)      —— 一次性画出所有棋子
 *   Pieces.drawPiece(ctx,p)  —— 画单个棋子
 *   Pieces.findAt(col,row)   —— 按交叉点查棋子（为后续“点击选中”预留）
 * ========================================================= */
const Pieces = (function () {
  'use strict';

  const CELL_SIZE = XIANGQI.CELL_SIZE;

  /* 棋子汉字：黑方 / 红方简体字 */
  const CHARS = {
    black: { che: '车', ma: '马', xiang: '象', shi: '士', jiang: '将', pao: '炮', bing: '卒' },
    red:   { che: '车', ma: '马', xiang: '相', shi: '仕', jiang: '帅', pao: '炮', bing: '兵' }
  };

  /* 棋子描边 / 文字颜色（按 side） */
  const INK = {
    black: '#1a1a1a',
    red:   '#c62828'
  };

  /* 底色：米白 */
  const FILL = '#f6f1e3';

  /* 尺寸：直径约为格宽的 0.85 */
  const DIAMETER = CELL_SIZE * 0.85;
  const RADIUS = DIAMETER / 2;

  /* ---------------------------------------------------------
   * 初始布局
   * row 0 在上（黑方），row 9 在下（红方）
   * --------------------------------------------------------- */
  function createInitialPieces() {
    const pieces = [];

    function add(side, type, col, row) {
      pieces.push({
        id: side + '_' + type + '_' + col,
        side: side,
        type: type,
        col: col,
        row: row,
        level: 0       // 进阶等级，本阶段预留，暂不使用
      });
    }

    // 底线排列：车 马 象/相 士/仕 将/帅 士/仕 象/相 马 车
    const BACK_ROW = ['che', 'ma', 'xiang', 'shi', 'jiang', 'shi', 'xiang', 'ma', 'che'];

    // 黑方底线 row 0
    BACK_ROW.forEach(function (type, col) {
      add('black', type, col, 0);
    });

    // 黑方 row 2：炮 col 1 / col 7
    add('black', 'pao', 1, 2);
    add('black', 'pao', 7, 2);

    // 黑方 row 3：卒 col 0 / 2 / 4 / 6 / 8
    [0, 2, 4, 6, 8].forEach(function (col) {
      add('black', 'bing', col, 3);
    });

    // 红方底线 row 9
    BACK_ROW.forEach(function (type, col) {
      add('red', type, col, 9);
    });

    // 红方 row 7：炮 col 1 / col 7
    add('red', 'pao', 1, 7);
    add('red', 'pao', 7, 7);

    // 红方 row 6：兵 col 0 / 2 / 4 / 6 / 8
    [0, 2, 4, 6, 8].forEach(function (col) {
      add('red', 'bing', col, 6);
    });

    return pieces;
  }

  const pieces = createInitialPieces();

  /* ---------------------------------------------------------
   * 绘制单个棋子
   * 坐标一律通过 Board.px / Board.py 换算，不自行计算
   * --------------------------------------------------------- */
  function drawPiece(ctx, piece) {
    const x = Board.px(piece.col);
    const y = Board.py(piece.row);
    const ink = INK[piece.side];
    const text = CHARS[piece.side][piece.type];

    ctx.save();

    // 外圈：米白底 + 按 side 颜色描边
    ctx.fillStyle = FILL;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 内圈：再描一道细边
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, RADIUS * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    // 中央汉字（颜色与描边一致）
    ctx.fillStyle = ink;
    ctx.font = 'bold ' + Math.round(CELL_SIZE * 0.5) + 'px "KaiTi", "STKaiti", "Kai", "SimSun", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 绘制全部棋子
   * --------------------------------------------------------- */
  function drawAll(ctx) {
    pieces.forEach(function (piece) {
      drawPiece(ctx, piece);
    });
  }

  /* ---------------------------------------------------------
   * 按交叉点查找棋子（为后续“点击选中”预留，本阶段不调用）
   * --------------------------------------------------------- */
  function findAt(col, row) {
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].col === col && pieces[i].row === row) {
        return pieces[i];
      }
    }
    return null;
  }

  return {
    pieces: pieces,
    drawAll: drawAll,
    drawPiece: drawPiece,
    findAt: findAt
  };
})();