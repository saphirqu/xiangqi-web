/* =========================================================
 * js/pieces.js —— 棋子数据与绘制
 * 只负责“棋子是什么、摆在哪、怎么画”，以及“当前谁被选中”这一状态：
 * 不监听任何事件（点击绑定在 js/input.js）。
 *
 * 对外暴露：
 *   Pieces.pieces            —— 棋子对象数组（含 id/side/type/col/row/level/selected）
 *   Pieces.drawAll(ctx)      —— 一次性画出所有棋子
 *   Pieces.drawPiece(ctx,p)  —— 画单个棋子
 *   Pieces.findAt(col,row)   —— 按交叉点查棋子
 *   Pieces.move(piece,c,r)   —— 把棋子移到目标交叉点（空点直接移，敌方棋子先吃掉）
 *   Pieces.select(piece)     —— 选中棋子（传 null 表示取消选中）
 *   Pieces.toggleSelect(p)   —— 已选中则取消，否则选中
 *   Pieces.clearSelection()  —— 取消当前选中
 *   Pieces.getSelected()     —— 取当前选中棋子（无则 null）
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

  /* 选中高亮：金色光晕 + 金色外圈 */
  const SELECT_RING_COLOR = '#ffc93c';                  // 外圈颜色
  const SELECT_RING_WIDTH = 3;                          // 外圈线宽
  const SELECT_RING_OFFSET = 6;                         // 外圈相对棋子半径的外扩
  const SELECT_GLOW_COLOR = 'rgba(255, 201, 60, 0.90)'; // 光晕颜色
  const SELECT_GLOW_BLUR = 14;                          // 光晕模糊半径
  const SELECT_GLOW_FILL = 'rgba(255, 201, 60, 0.38)';  // 光圈内填充

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
        level: 0,        // 进阶等级，本阶段预留，暂不使用
        selected: false  // 是否处于选中态（同一时间最多一个为 true）
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
   * 选中状态：同一时间最多只有一个棋子被选中
   *   selectedPiece 是唯一“真源”，piece.selected 只是给绘制看的快照
   * --------------------------------------------------------- */
  let selectedPiece = null;

  function clearSelection() {
    // 全部置 false，避免外部手动改过 flag 导致状态不同步
    pieces.forEach(function (piece) {
      piece.selected = false;
    });
    selectedPiece = null;
  }

  function select(piece) {
    if (!piece) {
      clearSelection();
      return null;
    }
    if (selectedPiece !== piece) {
      clearSelection();
      selectedPiece = piece;
      piece.selected = true;
    }
    return selectedPiece;
  }

  function toggleSelect(piece) {
    if (!piece) {
      clearSelection();
      return null;
    }
    // 点的就是当前选中那枚 -> 取消
    if (selectedPiece === piece) {
      clearSelection();
      return null;
    }
    // 点的另一枚 -> 选中自动转移（旧的自然被清掉）
    return select(piece);
  }

  function getSelected() {
    return selectedPiece;
  }

  /* ---------------------------------------------------------
   * 选中高亮：金色光晕 + 金色实线外圈
   * 先画高亮再画棋子本体，本体自然遮住光晕内侧，看起来像一圈发光边
   * --------------------------------------------------------- */
  function drawSelection(ctx, x, y) {
    const ringRadius = RADIUS + SELECT_RING_OFFSET;

    ctx.save();

    // 光晕层
    ctx.shadowColor = SELECT_GLOW_COLOR;
    ctx.shadowBlur = SELECT_GLOW_BLUR;
    ctx.fillStyle = SELECT_GLOW_FILL;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.fill();

    // 外圈
    ctx.shadowBlur = 0;
    ctx.strokeStyle = SELECT_RING_COLOR;
    ctx.lineWidth = SELECT_RING_WIDTH;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 绘制单个棋子
   * 坐标一律通过 Board.px / Board.py 换算，不自行计算
   * --------------------------------------------------------- */
  function drawPiece(ctx, piece) {
    const x = Board.px(piece.col);
    const y = Board.py(piece.row);
    const ink = INK[piece.side];
    const text = CHARS[piece.side][piece.type];

    // 选中态：先铺高亮，保证不被棋子本体盖住
    if (piece.selected) {
      drawSelection(ctx, x, y);
    }

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
   * 按交叉点查找棋子
   * --------------------------------------------------------- */
  function findAt(col, row) {
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].col === col && pieces[i].row === row) {
        return pieces[i];
      }
    }
    return null;
  }

  /* ---------------------------------------------------------
   * 从 pieces 中移除一枚棋子（内部使用，不对外暴露）
   * 函数声明会提升，所以这里可以先于定义引用 clearSelection
   * --------------------------------------------------------- */
  function removePiece(piece) {
    const index = pieces.indexOf(piece);
    if (index === -1) return false;

    // 被移除的恰好是当前选中那枚时，一并清掉选中状态，
    // 避免 selectedPiece 指向已经不在 pieces 里的对象（悬空引用）
    if (selectedPiece === piece) {
      clearSelection();
    }

    pieces.splice(index, 1);
    return true;
  }

  /* ---------------------------------------------------------
   * 走子：把 piece 移到交叉点 (col, row)
   *   目标有己方棋子 -> 不做任何改动，返回 null
   *   目标有敌方棋子 -> 先移除那枚敌方棋子，再改 piece 的 col / row
   *   目标为空       -> 直接改 piece 的 col / row
   * 本阶段不校验任何走子规则，也不做回合控制、胜负判定。
   * 移动成功后返回 piece，调用方负责取消选中并重绘。
   * --------------------------------------------------------- */
  function move(piece, col, row) {
    if (!piece) return null;

    // 目标点上的棋子（在移动之前先定下来）
    const target = findAt(col, row);

    // 目标点有己方棋子（也包括“点自己”）：位置不变，交给调用方做选中转移
    if (target && target.side === piece.side) {
      return null;
    }

    // 目标点是敌方棋子 -> 吃掉它
    if (target) {
      removePiece(target);
    }

    piece.col = col;
    piece.row = row;

    return piece;
  }

  return {
    pieces: pieces,
    drawAll: drawAll,
    drawPiece: drawPiece,
    findAt: findAt,
    move: move,
    select: select,
    toggleSelect: toggleSelect,
    clearSelection: clearSelection,
    getSelected: getSelected
  };
})();