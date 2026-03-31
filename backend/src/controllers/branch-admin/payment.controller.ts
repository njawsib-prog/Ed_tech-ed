import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import PDFDocument from 'pdfkit';

// Get payment history for branch
export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      studentId,
      status,
      startDate,
      endDate,
      sortBy = 'paidAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branch_id;

    let query = supabaseAdmin
      .from('payments')
      .select(`
        id,
        amount,
        status,
        paymentMethod,
        transactionId,
        paidAt,
        dueDate,
        lateFee,
        totalAmount,
        student:students(
          id,
          name,
          enrollmentNumber,
          batch:batches(id, name)
        ),
        receiptNumber
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (studentId) query = query.eq('studentId', studentId);
    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('paidAt', startDate);
    if (endDate) query = query.lte('paidAt', endDate);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: payments, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pending fees
export const getPendingFees = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branch_id;
    const { batchId } = req.query;

    let query = supabaseAdmin
      .from('pending_fees_view')
      .select('*')
      .eq('branchId', branchId);

    if (batchId) {
      query = query.eq('batchId', batchId);
    }

    const { data: pendingFees, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calculate summary
    const summary = {
      totalPending: pendingFees?.reduce((sum: number, f: any) => sum + (f.pendingAmount || 0), 0) || 0,
      totalStudents: pendingFees?.length || 0,
      overdueCount: pendingFees?.filter((f: any) => new Date(f.dueDate) < new Date()).length || 0
    };

    res.json({ pendingFees, summary });
  } catch (error) {
    console.error('Get pending fees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Record payment
export const recordPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      studentId,
      amount,
      paymentMethod,
      transactionId,
      feeMonth,
      feeYear,
      lateFee = 0,
      notes
    } = req.body;

    const branchId = req.user!.branch_id;
    const userId = req.user!.id;

    if (!branchId) {
      res.status(403).json({ error: 'Branch ID not assigned to user' });
      return;
    }

    // Verify student belongs to branch
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, name')
      .eq('id', studentId)
      .eq('branchId', branchId)
      .single();

    if (studentError || !student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Generate receipt number
    const receiptNumber = `RCP-${branchId.slice(0, 8)}-${Date.now()}`;

    // Create payment record
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        branchId,
        studentId,
        amount,
        paymentMethod,
        transactionId,
        feeMonth,
        feeYear,
        lateFee,
        totalAmount: amount + lateFee,
        status: 'completed',
        paidAt: new Date().toISOString(),
        receiptNumber,
        receivedBy: userId,
        notes
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Create notification for student
    const { data: studentUser } = await supabaseAdmin
      .from('students')
      .select('userId')
      .eq('id', studentId)
      .single();

    if (studentUser?.userId) {
      await supabaseAdmin.from('notifications').insert({
        userId: studentUser.userId,
        branchId,
        type: 'payment',
        title: 'Payment Received',
        message: `Your payment of ₹${amount + lateFee} has been recorded. Receipt: ${receiptNumber}`,
        data: { paymentId: payment.id }
      });
    }

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate receipt PDF
export const generateReceiptPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    // Get payment details
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        student:students(name, enrollmentNumber, email, phone),
        branch:branches(name, address, phone, email)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.receiptNumber}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(payment.branch?.name || 'Institute', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(payment.branch?.address || '', { align: 'center' });
    doc.text(`Phone: ${payment.branch?.phone || ''} | Email: ${payment.branch?.email || ''}`, { align: 'center' });
    doc.moveDown();

    // Receipt title
    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown();

    // Receipt details
    doc.fontSize(10).font('Helvetica');
    doc.text(`Receipt No: ${payment.receiptNumber}`, { width: 250 });
    doc.text(`Date: ${new Date(payment.paidAt).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Student details
    doc.fontSize(12).font('Helvetica-Bold').text('Student Details:');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${payment.student?.name}`);
    doc.text(`Enrollment No: ${payment.student?.enrollmentNumber}`);
    doc.text(`Email: ${payment.student?.email || 'N/A'}`);
    doc.moveDown();

    // Payment details table
    doc.fontSize(12).font('Helvetica-Bold').text('Payment Details:');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colWidths = [200, 100, 100, 100];

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', tableTop, colWidths[0]);
    doc.text('Amount', colWidths[0], colWidths[1]);
    doc.text('Late Fee', colWidths[0] + colWidths[1], colWidths[2]);
    doc.text('Total', colWidths[0] + colWidths[1] + colWidths[2], colWidths[3]);

    doc.moveDown();
    doc.fontSize(10).font('Helvetica');
    doc.text(`Fee for ${payment.feeMonth || ''}/${payment.feeYear || ''}`, colWidths[0]);
    doc.text(`₹${payment.amount}`, colWidths[0] + colWidths[1]);
    doc.text(`₹${payment.lateFee || 0}`, colWidths[0] + colWidths[1] + colWidths[2]);
    doc.text(`₹${payment.totalAmount}`, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]);

    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Grand Total: ₹${payment.totalAmount}`, { align: 'right' });
    doc.moveDown();

    // Payment method
    doc.fontSize(10).font('Helvetica');
    doc.text(`Payment Method: ${payment.paymentMethod}`);
    if (payment.transactionId) {
      doc.text(`Transaction ID: ${payment.transactionId}`);
    }
    doc.moveDown();

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica-Oblique').text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Generate receipt PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get fee defaulters
export const getFeeDefaulters = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branch_id;
    const { batchId, months = 2 } = req.query;

    // Get branch settings for due date
    const { data: settings } = await supabaseAdmin
      .from('branch_settings')
      .select('payment')
      .eq('branchId', branchId)
      .single();

    const dueDateDay = settings?.payment?.dueDateDay || 10;

    // Calculate defaulter threshold date
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - Number(months));

    // Query students with unpaid fees
    let query = supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        enrollmentNumber,
        phone,
        batch:batches(id, name),
        payments(amount, feeMonth, feeYear, paidAt, status)
      `)
      .eq('branchId', branchId)
      .eq('isActive', true);

    if (batchId) {
      query = query.eq('batchId', batchId);
    }

    const { data: students, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Filter defaulters
    const defaulters = students?.filter((student: any) => {
      const payments = student.payments || [];
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Check last N months
      for (let i = 1; i <= Number(months); i++) {
        const checkMonth = (currentMonth - i + 12) % 12;
        const checkYear = currentMonth - i < 0 ? currentYear - 1 : currentYear;

        const hasPayment = payments.some((p: any) =>
          p.feeMonth === checkMonth + 1 && p.feeYear === checkYear && p.status === 'completed'
        );

        if (!hasPayment) {
          return true;
        }
      }
      return false;
    }).map((student: any) => {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const pendingMonths: string[] = [];

      for (let i = 1; i <= Number(months); i++) {
        const checkMonth = (currentMonth - i + 12) % 12;
        const checkYear = currentMonth - i < 0 ? currentYear - 1 : currentYear;

        const hasPayment = student.payments.some((p: any) =>
          p.feeMonth === checkMonth + 1 && p.feeYear === checkYear && p.status === 'completed'
        );

        if (!hasPayment) {
          pendingMonths.push(`${checkMonth + 1}/${checkYear}`);
        }
      }

      return {
        id: student.id,
        name: student.name,
        enrollmentNumber: student.enrollmentNumber,
        phone: student.phone,
        batch: student.batch,
        pendingMonths
      };
    });

    res.json({
      defaulters,
      summary: {
        totalDefaulters: defaulters?.length || 0,
        monthsChecked: Number(months)
      }
    });
  } catch (error) {
    console.error('Get fee defaulters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send payment reminder
export const sendPaymentReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentIds } = req.body;
    const branchId = req.user!.branch_id;

    if (!studentIds?.length) {
      res.status(400).json({ error: 'Student IDs are required' });
      return;
    }

    // Get students
    const { data: students, error } = await supabaseAdmin
      .from('students')
      .select('id, name, userId')
      .in('id', studentIds)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Create notifications
    const notifications = students?.map((student: any) => ({
      userId: student.userId,
      branchId,
      type: 'payment_reminder',
      title: 'Fee Payment Reminder',
      message: 'This is a reminder to pay your pending fees. Please clear your dues at the earliest.',
      data: {}
    }));

    if (notifications && notifications.length > 0) {
      await supabaseAdmin.from('notifications').insert(notifications);
    }

    res.json({
      message: 'Payment reminders sent successfully',
      sentCount: students?.length || 0
    });
  } catch (error) {
    console.error('Send payment reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payment statistics
export const getPaymentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branch_id;
    const { period = 'month' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get payments for period
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, lateFee, totalAmount, status, paidAt, paymentMethod')
      .eq('branchId', branchId)
      .gte('paidAt', startDate.toISOString());

    // Calculate stats
    const stats = {
      totalCollected: payments?.reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0,
      totalTransactions: payments?.length || 0,
      byPaymentMethod: {} as Record<string, number>,
      pending: 0,
      overdue: 0
    };

    payments?.forEach((p) => {
      stats.byPaymentMethod[p.paymentMethod] = (stats.byPaymentMethod[p.paymentMethod] || 0) + (p.totalAmount || 0);
    });

    // Get pending count
    const { count: pendingCount } = await supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('branchId', branchId)
      .eq('status', 'pending');

    stats.pending = pendingCount || 0;

    res.json(stats);
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};