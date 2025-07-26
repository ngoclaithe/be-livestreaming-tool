const express = require('express');
const router = express.Router();
const logoController = require('../controllers/logo.controller');
const { uploadSingle } = require('../middleware/localUpload');

/**
 * @swagger
 * components:
 *   schemas:
 *     Logo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated ID of the logo
 *         code_logo:
 *           type: string
 *           description: Unique code identifier for the logo
 *         type_logo:
 *           type: string
 *           enum: [home, away, tournament, other]
 *           description: Type of the logo
 *         url_logo:
 *           type: string
 *           format: uri
 *           description: Public URL to access the logo
 *         file_path:
 *           type: string
 *           description: Internal filesystem path to the logo file
 *         uploader_ip:
 *           type: string
 *           description: IP address of the uploader
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the logo was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the logo was last updated
 *       example:
 *         id: 1
 *         code_logo: "logo_123456789"
 *         type_logo: "home"
 *         url_logo: "http://localhost:5000/uploads/logo-123456789.png"
 *         file_path: "/path/to/uploads/logo-123456789.png"
 *         uploader_ip: "192.168.1.1"
 *         createdAt: "2023-07-24T04:00:00.000Z"
 *         updatedAt: "2023-07-24T04:00:00.000Z"
 */

/**
 * @swagger
 * /api/v1/logos:
 *   post:
 *     summary: Upload a new logo
 *     description: Upload a logo image file to the server
 *     tags: [Logos]

 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - type
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The logo image file (PNG, JPG, GIF, max 5MB)
 *               type:
 *                 type: string
 *                 enum: [logo, banner]
 *                 description: Type of the logo (logo or banner)
 *               name:
 *                 type: string
 *                 description: Optional name for the logo/banner (defaults to the logo type if not provided)
 *     responses:
 *       201:
 *         description: Logo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Logo'
 *       400:
 *         description: Invalid request or file type
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
// Route for file upload - handle multipart/form-data
router.route('/')
  .post(uploadSingle('file'), logoController.uploadLogo);
/**
 * @swagger
 * /api/v1/logos:
 *   get:
 *     summary: Get all logos for the authenticated user
 *     description: Retrieve a list of logos owned by the authenticated user, optionally filtered by type
 *     tags: [Logos]

 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter logos by type (logo or banner)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter logos by name (case-insensitive partial match)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter logos by code or name
 *     responses:
 *       200:
 *         description: A list of logos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Logo'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.get('/', logoController.getLogos);

/**
 * @swagger
 * /api/v1/logos/code/{code}:
 *   get:
 *     summary: Tìm kiếm logo theo mã
 *     description: |
 *       Tìm kiếm logo theo mã chính xác hoặc một phần mã.
 *       - Trả về tối đa 10 kết quả gần nhất
 *       - Phân biệt chữ hoa chữ thường
 *       - Có thể tìm kiếm chính xác hoặc một phần
 *     tags: [Logos]

 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           example: L123
 *         description: |
 *           Mã logo hoặc một phần mã cần tìm.
 *           - Bắt đầu bằng 'L' cho logo thông thường
 *           - Bắt đầu bằng 'B' cho banner
 *           - Ví dụ: L123, B45, v.v.
 *       - in: query
 *         name: exact
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           Chế độ tìm kiếm:
 *           - `false` (mặc định): Tìm kiếm một phần mã
 *           - `true`: Tìm kiếm chính xác mã
 *     responses:
 *       200:
 *         description: Thành công. Trả về danh sách logo phù hợp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data, total, isExactMatch]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Logo'
 *                 total:
 *                   type: integer
 *                   minimum: 0
 *                   example: 3
 *                   description: Số lượng kết quả trả về
 *                 isExactMatch:
 *                   type: boolean
 *                   example: false
 *                   description: Có phải kết quả tìm kiếm chính xác không
 *       400:
 *         description: |
 *           Lỗi yêu cầu:
 *           - Thiếu tham số code
 *           - Code vượt quá độ dài cho phép
 *           - Định dạng code không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy logo nào phù hợp
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *     examples:
 *       Tìm kiếm một phần:
 *         value:
 *           summary: Tìm kiếm một phần mã
 *           description: Tìm tất cả logo có mã chứa 'L12'
 *           value:
 *             url: /api/v1/logos/code/L12
 *             response:
 *               success: true
 *               data: [...]
 *               total: 2
 *               isExactMatch: false
 *       Tìm kiếm chính xác:
 *         value:
 *           summary: Tìm kiếm chính xác mã
 *           description: Tìm logo có mã chính xác 'L12345'
 *           value:
 *             url: /api/v1/logos/code/L12345?exact=true
 *             response:
 *               success: true
 *               data: [{...}]
 *               total: 1
 *               isExactMatch: true
 */
router.get('/code/:code', logoController.getLogoByCode);

/**
 * @swagger
 * /api/v1/logos/{id}:
 *   get:
 *     summary: Get logo by ID
 *     description: Retrieve a logo by its ID (authenticated users only)
 *     tags: [Logos]

 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The logo ID
 *     responses:
 *       200:
 *         description: Logo found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Logo'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - User doesn't have permission to access this logo
 *       404:
 *         description: Logo not found
 *       500:
 *         description: Server error
 */
router.get('/:id', logoController.getLogo);

/**
 * @swagger
 * /api/v1/logos/{id}:
 *   put:
 *     summary: Update a logo
 *     description: Update a logo's type or upload a new image file
 *     tags: [Logos]

 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The logo ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The new logo image file (PNG, JPG, GIF, max 5MB)
 *               type:
 *                 type: string
 *                 enum: [home, away, tournament, other]
 *                 description: New type for the logo
 *     responses:
 *       200:
 *         description: Logo updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Logo'
 *       400:
 *         description: Invalid request or file type
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - User doesn't have permission to update this logo
 *       404:
 *         description: Logo not found
 *       500:
 *         description: Server error
 */
router.put('/:id', uploadSingle('file'), logoController.updateLogo);

/**
 * @swagger
 * /api/v1/logos/{id}:
 *   delete:
 *     summary: Delete a logo
 *     description: Delete a specific logo and its associated file
 *     tags: [Logos]

 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The logo ID to delete
 *     responses:
 *       200:
 *         description: Logo deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   example: {}
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - User doesn't have permission to delete this logo
 *       404:
 *         description: Logo not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', logoController.deleteLogo);

module.exports = router;
