/* =========================================================
 * js/main.js —— 程序入口
 * 负责：拿到 canvas、适配高清屏、触发棋盘与棋子绘制
 * ========================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  /**
   * 适配高清屏（devicePixelRatio）
   * - 画布“属性宽高” = CSS 宽高 × dpr，用真实像素绘制，线条才够锐利
   * - 画布“显示宽高” = CSS 宽高；小屏时由 CSS 的 max-width 等比缩小
   * - setTransform 把绘制坐标系换算回 CSS 像素，
   *   这样 board.js 里可以完全按 CSS 像素来写坐标
   */
  function setupHiDPI() {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = XIANGQI.CANVAS_WIDTH;
    const cssHeight = XIANGQI.CANVAS_HEIGHT;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    Board.draw(ctx);       // 先画空棋盘
    Pieces.drawAll(ctx);   // 再画棋子
  }

  function init() {
    setupHiDPI();
    render();
  }

  init();
})();