/* =========================================================
 * js/board.js —— 棋盘绘制
 * 只负责“把空棋盘画出来”，不涉及棋子与游戏逻辑。
 * 对外暴露 Board.draw(ctx) 以及坐标换算 Board.px / Board.py
 * ========================================================= */
const Board = (function () {
  'use strict';

  const COLS = XIANGQI.COLS;
  const ROWS = XIANGQI.ROWS;
  const CELL_SIZE = XIANGQI.CELL_SIZE;
  const MARGIN = XIANGQI.MARGIN;
  const BOARD_WIDTH = XIANGQI.BOARD_WIDTH;
  const BOARD_HEIGHT = XIANGQI.BOARD_HEIGHT;
  const CANVAS_WIDTH = XIANGQI.CANVAS_WIDTH;
  const CANVAS_HEIGHT = XIANGQI.CANVAS_HEIGHT;
  const RIVER_TOP_ROW = XIANGQI.RIVER_TOP_ROW;
  const RIVER_BOTTOM_ROW = XIANGQI.RIVER_BOTTOM_ROW;
  const PALACE_LEFT_COL = XIANGQI.PALACE_LEFT_COL;
  const PALACE_RIGHT_COL = XIANGQI.PALACE_RIGHT_COL;
  const BLACK_PALACE_TOP_ROW = XIANGQI.BLACK_PALACE_TOP_ROW;
  const RED_PALACE_BOTTOM_ROW = XIANGQI.RED_PALACE_BOTTOM_ROW;
  const COLORS = XIANGQI.COLORS;

  // 1px 细线偏移半像素，让线条落在像素中心，避免发虚
  const LINE_OFFSET = 0.5;

  // 外框装饰线相对网格的外扩距离
  const FRAME_PAD = 16;

  // 炮位 / 兵位角标的形状参数
  const MARKER_GAP = 5;   // 角标与交叉点的间距
  const MARKER_LEN = 9;   // 角标两条臂的长度

  /* ---------------------------------------------------------
   * 坐标换算：交叉点 (col, row) -> 画布像素坐标（CSS 像素）
   * --------------------------------------------------------- */
  function px(col) {
    return MARGIN + col * CELL_SIZE;
  }

  function py(row) {
    return MARGIN + row * CELL_SIZE;
  }

  /* ---------------------------------------------------------
   * 需要绘制“角标”的交叉点：
   *   炮位 4 个（黑炮 2 + 红炮 2）
   *   兵位 / 卒位 10 个（黑卒 5 + 红兵 5）
   * --------------------------------------------------------- */
  const MARKER_POINTS = [
    // 炮位
    [1, 2], [7, 2],
    [1, 7], [7, 7],
    // 兵位（上方黑方）
    [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
    // 卒位（下方红方）
    [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]
  ];

  /* ---------------------------------------------------------
   * 1. 底色 + 轻微木纹渐变
   * --------------------------------------------------------- */
  function drawBackground(ctx) {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 左上偏亮、右下偏暗，营造木板的受光感
    const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    grad.addColorStop(0, 'rgba(255, 248, 224, 0.60)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(146, 100, 46, 0.20)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  /* ---------------------------------------------------------
   * 2. 外框装饰线（双线边框的外圈）
   * --------------------------------------------------------- */
  function drawOuterFrame(ctx) {
    ctx.save();
    ctx.strokeStyle = COLORS.frame;
    ctx.lineWidth = 3;

    const x = px(0) - FRAME_PAD;
    const y = py(0) - FRAME_PAD;
    const w = BOARD_WIDTH + FRAME_PAD * 2;
    const h = BOARD_HEIGHT + FRAME_PAD * 2;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 3. 网格线
   *   - 横线 10 条：贯穿左右
   *   - 竖线 9 条：最左 / 最右两条（col 0 与 col 8）贯通上下；
   *     其余 7 条在“楚河汉界”处断开，只画上半盘与下半盘
   * --------------------------------------------------------- */
  function drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // 横线
    for (let row = 0; row < ROWS; row++) {
      const y = py(row);
      ctx.moveTo(px(0), y);
      ctx.lineTo(px(COLS - 1), y);
    }

    // 竖线
    for (let col = 0; col < COLS; col++) {
      const x = px(col);
      const isEdgeCol = (col === 0 || col === COLS - 1);

      if (isEdgeCol) {
        // 边线贯通整张棋盘
        ctx.moveTo(x, py(0));
        ctx.lineTo(x, py(ROWS - 1));
      } else {
        // 上半盘：row 0 -> 河界上沿
        ctx.moveTo(x, py(0));
        ctx.lineTo(x, py(RIVER_TOP_ROW));
        // 下半盘：河界下沿 -> row 9
        ctx.moveTo(x, py(RIVER_BOTTOM_ROW));
        ctx.lineTo(x, py(ROWS - 1));
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 4. 九宫斜线（上九宫、下九宫各两条对角线）
   * --------------------------------------------------------- */
  function drawPalaces(ctx) {
    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // 上方九宫（黑方）：左上 -> 右下，右上 -> 左下
    ctx.moveTo(px(PALACE_LEFT_COL), py(BLACK_PALACE_TOP_ROW));
    ctx.lineTo(px(PALACE_RIGHT_COL), py(BLACK_PALACE_TOP_ROW + 2));

    ctx.moveTo(px(PALACE_RIGHT_COL), py(BLACK_PALACE_TOP_ROW));
    ctx.lineTo(px(PALACE_LEFT_COL), py(BLACK_PALACE_TOP_ROW + 2));

    // 下方九宫（红方）：左上 -> 右下，右上 -> 左下
    ctx.moveTo(px(PALACE_LEFT_COL), py(RED_PALACE_BOTTOM_ROW - 2));
    ctx.lineTo(px(PALACE_RIGHT_COL), py(RED_PALACE_BOTTOM_ROW));

    ctx.moveTo(px(PALACE_RIGHT_COL), py(RED_PALACE_BOTTOM_ROW - 2));
    ctx.lineTo(px(PALACE_LEFT_COL), py(RED_PALACE_BOTTOM_ROW));

    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 5. 炮位 / 兵位角标
   *    在每个交叉点的四个象限画“小直角”，直角向外张开；
   *    棋盘左右边缘处朝外的角标省略不画（与真实棋盘一致）。
   * --------------------------------------------------------- */
  function drawMarkers(ctx) {
    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // 四个象限方向：[横向 sx, 纵向 sy]
    const CORNERS = [
      [-1, -1], [1, -1],
      [-1, 1], [1, 1]
    ];

    MARKER_POINTS.forEach(function (point) {
      const col = point[0];
      const row = point[1];
      const cx = px(col);
      const cy = py(row);

      CORNERS.forEach(function (corner) {
        const sx = corner[0];
        const sy = corner[1];

        // 最左列不画朝左的角标；最右列不画朝右的角标
        if (col === 0 && sx === -1) return;
        if (col === COLS - 1 && sx === 1) return;

        // 直角顶点（距交叉点 MARKER_GAP）
        const vertexX = cx + sx * MARKER_GAP;
        const vertexY = cy + sy * MARKER_GAP;

        // 横臂
        ctx.moveTo(vertexX, vertexY);
        ctx.lineTo(vertexX + sx * MARKER_LEN, vertexY);

        // 竖臂
        ctx.moveTo(vertexX, vertexY);
        ctx.lineTo(vertexX, vertexY + sy * MARKER_LEN);
      });
    });

    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 6. 楚河汉界
   *    河带位于 row 4 与 row 5 之间，文字居中于河带高度
   * --------------------------------------------------------- */
  function centerChars(ctx, text, centerX, centerY, spacing) {
    const chars = String(text).split('');
    const totalWidth = (chars.length - 1) * spacing;
    const startX = centerX - totalWidth / 2;

    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], startX + i * spacing, centerY);
    }
  }

  function drawRiver(ctx) {
    // 河带中心线：row 4 与 row 5 的正中间
    const centerY = py((RIVER_TOP_ROW + RIVER_BOTTOM_ROW) / 2);
    const fontSize = Math.round(CELL_SIZE * 0.56);

    ctx.save();
    ctx.fillStyle = COLORS.riverText;
    ctx.font = 'bold ' + fontSize + 'px "KaiTi", "STKaiti", "Kai", "SimSun", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // “楚河”偏左（以第 2 列为中心），“汉界”偏右（以第 6 列为中心）
    centerChars(ctx, '楚河', px(2), centerY, CELL_SIZE * 0.82);
    centerChars(ctx, '汉界', px(6), centerY, CELL_SIZE * 0.82);

    ctx.restore();
  }

  /* ---------------------------------------------------------
   * 7. 对外入口：绘制整张棋盘
   * --------------------------------------------------------- */
  function draw(ctx) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawBackground(ctx);   // 底色（无需像素对齐）

    // 所有线条统一做半像素偏移，保证 1px 细线清晰
    ctx.save();
    ctx.translate(LINE_OFFSET, LINE_OFFSET);
    drawOuterFrame(ctx);
    drawGrid(ctx);
    drawPalaces(ctx);
    drawMarkers(ctx);
    ctx.restore();

    drawRiver(ctx);        // 文字（无需像素对齐）
  }

  return {
    draw: draw,
    px: px,
    py: py,
    MARKER_POINTS: MARKER_POINTS
  };
})();
