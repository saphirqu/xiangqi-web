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
 *   Pieces.move(piece,c,r)   —— 走子（先按 Rules 校验走法，空点直接移，敌方棋子先吃掉）
 *   Pieces.select(piece)     —— 选中棋子（传 null 表示取消选中）
 *   Pieces.toggleSelect(p)   —— 已选中则取消，否则选中
 *   Pieces.clearSelection()  —— 取消当前选中
 *   Pieces.getSelected()     —— 取当前选中棋子（无则 null）
 *   Pieces.reset()           —— 重置为初始布局，并清空选中态
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

  /* 合法落点提示：全部用绿色，靠形态区分（空点 = 实心小圆点，可吃敌子 = 细圆环），
   * 与金色选中高亮、米黄棋盘底色都能明显区分 */
  const HINT_DOT_COLOR = 'rgba(46, 160, 67, 0.75)';   // 空点小圆点的填充色（绿色半透明）
  const HINT_DOT_RADIUS = CELL_SIZE * 0.12;           // 小圆点半径（约 7.2px）
  const HINT_RING_COLOR = 'rgba(46, 160, 67, 0.90)';  // 可吃敌子的圆环颜色（绿色半透明）
  const HINT_RING_WIDTH = 2;                          // 圆环线宽
  const HINT_RING_OFFSET = 5;                         // 圆环相对棋子半径的外扩

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
   * 绘制合法落点提示（供选中棋子使用）
   *   空点       -> 绿色实心小圆点
   *   敌方棋子点 -> 绿色细圆环（半径 = 棋子半径 + 外扩，正好把敌子圈住）
   * 落点来源是 Rules.getLegalTargets，已过滤掉自身与己方棋子，
   * 所以这里查到的棋子一定是敌方棋子。
   * 分两趟画：先统一描所有圆环、再统一填所有小圆点，
   * 避免 fillStyle / strokeStyle 在同一个路径里反复切换。
   * --------------------------------------------------------- */
  function drawMoveHints(ctx, piece) {
    const targets = Rules.getLegalTargets(piece);

    ctx.save();

    // 第一趟：可吃敌子 -> 绿色细圆环
    ctx.strokeStyle = HINT_RING_COLOR;
    ctx.lineWidth = HINT_RING_WIDTH;
    ctx.beginPath();

    targets.forEach(function (target) {
      // 空点交给第二趟画，这里只管有棋子的落点
      if (!findAt(target.col, target.row)) return;

      const x = Board.px(target.col);
      const y = Board.py(target.row);
      const radius = RADIUS + HINT_RING_OFFSET;

      ctx.moveTo(x + radius, y);   // 断开与上一个圆的连线
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    });

    ctx.stroke();

    // 第二趟：空点 -> 绿色实心小圆点
    ctx.fillStyle = HINT_DOT_COLOR;
    ctx.beginPath();

    targets.forEach(function (target) {
      // 有棋子的落点已经在第一趟画过
      if (findAt(target.col, target.row)) return;

      const x = Board.px(target.col);
      const y = Board.py(target.row);

      ctx.moveTo(x + HINT_DOT_RADIUS, y);   // 断开与上一个圆的连线
      ctx.arc(x, y, HINT_DOT_RADIUS, 0, Math.PI * 2);
    });

    ctx.fill();

    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 绘制全部棋子（附当前选中棋子的合法落点提示）
   * 提示画在棋子之前（即棋子底层）：
   *   空点小圆点画在无子的交叉点上，怎么画都不会跟棋子打架；
   *   可吃敌子的圆环半径是「棋子半径 + 5」，正好贴着敌子外沿，
   *   放在底层能保证只露出一圈干净的绿色外环，不会压掉敌子本身的描边与汉字。
   * 取消选中 / 走子后选中态被清掉，下次整盘重绘就不再有提示。
   * --------------------------------------------------------- */
  function drawAll(ctx) {
    const selected = getSelected();

    if (selected) {
      drawMoveHints(ctx, selected);
    }

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
   *   第一步先交给 Rules.canMove 校验走法形状，不合法直接放弃
   *   目标有己方棋子 -> 不做任何改动，返回 null
   *   目标有敌方棋子 -> 先移除那枚敌方棋子，再改 piece 的 col / row
   *   目标为空       -> 直接改 piece 的 col / row
   * 走法规则见 js/rules.js；送将 / 将帅对面、回合控制、胜负判定均未实现。
   * 移动成功后返回 piece，调用方负责取消选中并重绘。
   * --------------------------------------------------------- */
  function move(piece, col, row) {
    if (!piece) return null;

    // 先校验走法规则：不合法就直接放弃，棋盘状态保持原样
    if (!Rules.canMove(piece, col, row)) return null;

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

  /* ---------------------------------------------------------
   * 重置为初始布局（供「再来一局」使用）
   * pieces 是模块内唯一的棋子容器，外部（如 game.js）拿到的是同一个数组引用，
   * 所以不能重新赋值，只能“原地清空 + 重新灌入”，否则外部引用会失效。
   * 被吃掉的棋子会随着清空一并消失，重新生成后自然全部回到初始位置。
   * --------------------------------------------------------- */
  function reset() {
    pieces.length = 0;                              // 原地清空（保留数组引用）
    createInitialPieces().forEach(function (piece) {
      pieces.push(piece);
    });
    clearSelection();                               // 选中态一并清掉，避免悬空引用
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
    getSelected: getSelected,
    reset: reset
  };
})();