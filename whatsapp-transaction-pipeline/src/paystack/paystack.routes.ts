import { Router } from 'express';
import { PaystackController } from './paystack.controller';

const router = Router();
const controller = new PaystackController();

router.post('/verify', controller.verify.bind(controller));
router.post('/webhook', controller.handleWebhook.bind(controller));
router.post('/cancel', controller.cancel.bind(controller));

export default router;
