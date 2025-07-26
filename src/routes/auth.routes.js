const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Xác thực người dùng
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: Họ và tên
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Địa chỉ email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Mật khẩu (tối thiểu 6 ký tự)
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 default: user
 *                 description: Vai trò người dùng
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Email đã được sử dụng hoặc dữ liệu không hợp lệ
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Địa chỉ email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Mật khẩu
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Thiếu email hoặc mật khẩu
 *       401:
 *         description: Thông tin đăng nhập không chính xác
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Lấy thông tin người dùng hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Không được phép truy cập
 */
router.get('/me', protect, authController.getMe);

/**
 * @swagger
 * /api/v1/auth/updatedetails:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên mới
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email mới
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 */
router.put('/updatedetails', protect, authController.updateDetails);

/**
 * @swagger
 * /api/v1/auth/updatepassword:
 *   put:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Mật khẩu hiện tại
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Mật khẩu mới (tối thiểu 6 ký tự)
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu hiện tại không chính xác hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 */
router.put('/updatepassword', protect, authController.updatePassword);

/**
 * @swagger
 * /api/v1/auth/forgotpassword:
 *   post:
 *     summary: Yêu cầu đặt lại mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Địa chỉ email đăng ký
 *     responses:
 *       200:
 *         description: Email đặt lại mật khẩu đã được gửi
 *       404:
 *         description: Không tìm thấy người dùng với email này
 */
router.post('/forgotpassword', authController.forgotPassword);

/**
 * @swagger
 * /api/v1/auth/resetpassword/{resettoken}:
 *   put:
 *     summary: Đặt lại mật khẩu
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: resettoken
 *         required: true
 *         schema:
 *           type: string
 *         description: Token đặt lại mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Mật khẩu mới (tối thiểu 6 ký tự)
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: Token không hợp lệ hoặc đã hết hạn
 */
router.put('/resetpassword/:resettoken', authController.resetPassword);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   get:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Không được phép truy cập
 */
router.get('/logout', protect, authController.logout);

module.exports = router;
