import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import PDFDocument from 'pdfkit';

/**
 * Get all payments (global)
 * GET /api/super-admin/payments
 */
export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, branch_id, start_date, end_date } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        students(name, student_code, branch_id, branches(name)),
        admins(name)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (start_date) {
      query = query.gte('payment_date', start_date as string);
    }

    if (end_date) {
      query = query.lte('payment_date', end_date as string);
    }

    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('payment_date', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calculate totals
    const { data: totals } = await supabaseAdmin
      .from('payments')
      .select('amount, status')
      .in('status', ['pending', 'verified']);

    const summary = {
      total: totals?.reduce((acc, p) => acc + Number(p.amount), 0) || 0,
      pending: totals?.filter(p => p.status === 'pending').reduce((acc, p) => acc + Number(p.amount), 0) || 0,
      verified: totals?.filter(p => p.status === 'verified').reduce((acc, p) => acc + Number(p.amount), 0) || 0,
    };

    res.json({
      payments: data,
      summary,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

/**
 * Verify payment
 * PATCH /api/super-admin/payments/:id/verify
 */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get payment details
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    if (payment.status !== 'pending') {
      res.status(400).json({ error: 'Only pending payments can be verified' });
      return;
    }

    // Update payment status
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'verified',
        verified_by: req.user?.id,
        verified_at: new Date().toISOString(),
        receipt_number: `RCP-${Date.now()}`,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Log to audit
    await supabaseAdmin.from('audit_logs').insert({
      user_id: req.user?.id,
      branch_id: payment.branch_id,
      action: 'VERIFY',
      entity: 'payments',
      entity_id: id,
      new_values: { status: 'verified' },
    });

    res.json({ message: 'Payment verified successfully', payment: data });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

/**
 * Generate receipt PDF
 * GET /api/super-admin/payments/:id/receipt
 */
export const generateReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        students(name, student_code, branches(name, location)),
        branches(name, location)
      `)
      .eq('id', id)
      .single();

    if (error || !payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.receipt_number}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(payment.branches?.name || 'EdTech Platform', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(payment.branches?.location || '', { align: 'center' });
    doc.moveDown();

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown();

    // Receipt details
    doc.fontSize(10).font('Helvetica');
    doc.text(`Receipt No: ${payment.receipt_number}`, { align: 'right' });
    doc.text(`Date: ${new Date(payment.payment_date).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Student details
    doc.font('Helvetica-Bold').text('Student Details:', { underline: true });
    doc.font('Helvetica');
    doc.text(`Name: ${payment.students?.name}`);
    doc.text(`Student Code: ${payment.students?.student_code}`);
    doc.moveDown();

    // Payment details
    doc.font('Helvetica-Bold').text('Payment Details:', { underline: true });
    doc.font('Helvetica');
    doc.text(`Amount: ₹${Number(payment.amount).toLocaleString()}`);
    doc.text(`Mode: ${payment.mode.toUpperCase()}`);
    doc.text(`Status: ${payment.status.toUpperCase()}`);
    if (payment.transaction_id) {
      doc.text(`Transaction ID: ${payment.transaction_id}`);
    }
    doc.moveDown();

    // Footer
    doc.fontSize(8).text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
};

/**
 * Get defaulters list
 * GET /api/super-admin/payments/defaulters
 */
export const getDefaulters = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, branch_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        student_code,
        email,
        phone,
        defaulter_flag,
        branches(id, name),
        courses(title)
      `, { count: 'exact' })
      .eq('defaulter_flag', true);

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      defaulters: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get defaulters error:', error);
    res.status(500).json({ error: 'Failed to fetch defaulters' });
  }
};

export default {
  getPayments,
  verifyPayment,
  generateReceipt,
  getDefaulters,
};