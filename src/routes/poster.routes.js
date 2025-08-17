const express = require('express');
const router = express.Router();
const posterController = require('../controllers/poster.controller');
const { uploadSingle } = require('../middleware/localUpload');

/**
 * @swagger
 * components:
 *   schemas:
 *     Poster:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated ID of the poster
 *         name:
 *           type: string
 *           description: Name of the poster
 *         description:
 *           type: string
 *           description: Description of the poster
 *         file_path:
 *           type: string
 *           description: Path to the uploaded poster file
 *         file_name:
 *           type: string
 *           description: Original filename of the poster
 *         file_size:
 *           type: integer
 *           description: Size of the poster file in bytes
 *         file_type:
 *           type: string
 *           description: MIME type of the poster file
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the poster was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the poster was last updated
 */

/**
 * @swagger
 * /api/v1/posters:
 *   post:
 *     summary: Tải lên poster mới
 *     tags: [Posters]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             required:
 *               - file
 *               - accessCode
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh poster
 *               accessCode:
 *                 type: string
 *                 description: Mã truy cập (bắt buộc)
 *               name:
 *                 type: string
 *                 description: Tên poster
 *               description:
 *                 type: string
 *                 description: Mô tả poster
 *     responses:
 *       201:
 *         description: Tải lên poster thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poster'
 *       400:
 *         description: Lỗi dữ liệu đầu vào không hợp lệ
 */
router.post('/', uploadSingle('file'), posterController.uploadPoster);

/**
 * @swagger
 * /api/v1/posters:
 *   get:
 *     summary: Lấy danh sách poster
 *     tags: [Posters]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên poster
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Trường để sắp xếp (createdAt, name, etc.)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           default: DESC
 *           enum: [ASC, DESC]
 *         description: Thứ tự sắp xếp (tăng dần/giảm dần)
 *     responses:
 *       200:
 *         description: Danh sách poster
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Poster'
 */
router.get('/', posterController.getPosters);

/**
 * @swagger
 * /api/v1/posters/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết poster
 *     tags: [Posters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của poster
 *     responses:
 *       200:
 *         description: Thông tin chi tiết poster
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poster'
 *       404:
 *         description: Không tìm thấy poster
 */
router.get('/:id', posterController.getPoster);

/**
 * @swagger
 * /api/v1/posters/{id}:
 *   put:
 *     summary: Cập nhật thông tin poster
 *     tags: [Posters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của poster cần cập nhật
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh poster mới (tùy chọn)
 *               name:
 *                 type: string
 *                 description: Tên mới cho poster
 *               description:
 *                 type: string
 *                 description: Mô tả mới cho poster
 *     responses:
 *       200:
 *         description: Cập nhật poster thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poster'
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       404:
 *         description: Không tìm thấy poster
 */
router.put('/:id', uploadSingle('file'), posterController.updatePoster);

/**
 * @swagger
 * /api/v1/posters/{id}:
 *   delete:
 *     summary: Xóa poster
 *     tags: [Posters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của poster cần xóa
 *     responses:
 *       200:
 *         description: Xóa poster thành công
 *       404:
 *         description: Không tìm thấy poster
 */
router.delete('/:id', posterController.deletePoster);

module.exports = router;
