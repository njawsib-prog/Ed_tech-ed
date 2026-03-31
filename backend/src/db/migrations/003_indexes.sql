-- EdTech Platform - Performance Indexes
-- Run this AFTER 002_rls_policies.sql

-- ============================================
-- BRANCH INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_branches_admin_user_id ON branches(admin_user_id);

-- ============================================
-- USER INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================
-- ADMIN INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_branch_id ON admins(branch_id);

-- ============================================
-- STUDENT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_branch_id ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_course_id ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_defaulter_flag ON students(defaulter_flag);
CREATE INDEX IF NOT EXISTS idx_students_name ON students USING gin(to_tsvector('english', name));

-- ============================================
-- COURSE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);

-- ============================================
-- MODULE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_order_index ON modules(order_index);

-- ============================================
-- SUBJECT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subjects_module_id ON subjects(module_id);
CREATE INDEX IF NOT EXISTS idx_subjects_order_index ON subjects(order_index);

-- ============================================
-- TEST INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tests_branch_id ON tests(branch_id);
CREATE INDEX IF NOT EXISTS idx_tests_course_id ON tests(course_id);
CREATE INDEX IF NOT EXISTS idx_tests_is_active ON tests(is_active);
CREATE INDEX IF NOT EXISTS idx_tests_type ON tests(type);
CREATE INDEX IF NOT EXISTS idx_tests_scheduled_at ON tests(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);

-- ============================================
-- QUESTION INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_order_index ON questions(order_index);

-- ============================================
-- TEST ASSIGNMENT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_test_assignments_test_id ON test_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_test_assignments_student_id ON test_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_test_assignments_is_completed ON test_assignments(is_completed);
CREATE INDEX IF NOT EXISTS idx_test_assignments_assigned_at ON test_assignments(assigned_at DESC);

-- ============================================
-- RESULT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_results_test_id ON results(test_id);
CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_score ON results(score DESC);
CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON results(submitted_at DESC);

-- Composite index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_results_student_score ON results(student_id, score DESC);

-- ============================================
-- STUDY MATERIAL INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_study_materials_branch_id ON study_materials(branch_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_course_id ON study_materials(course_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_module_id ON study_materials(module_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_type ON study_materials(type);
CREATE INDEX IF NOT EXISTS idx_study_materials_is_active ON study_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_study_materials_order_index ON study_materials(order_index);

-- ============================================
-- NOTIFICATION INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_type ON notifications(target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_target_id ON notifications(target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- NOTIFICATION READS INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_student_id ON notification_reads(student_id);

-- ============================================
-- COMPLAINT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_complaints_student_id ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_branch_id ON complaints(branch_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

-- ============================================
-- COMPLAINT REPLIES INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_complaint_replies_complaint_id ON complaint_replies(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_replies_created_at ON complaint_replies(created_at DESC);

-- ============================================
-- FEEDBACK INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_feedback_student_id ON feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_branch_id ON feedback(branch_id);
CREATE INDEX IF NOT EXISTS idx_feedback_target_type ON feedback(target_type);
CREATE INDEX IF NOT EXISTS idx_feedback_target_id ON feedback(target_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================
-- PAYMENT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_mode ON payments(mode);
CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- ============================================
-- ATTENDANCE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_id ON attendance(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_qr_token ON attendance(qr_token);

-- Composite index for attendance reports
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance(branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date DESC);

-- ============================================
-- AUDIT LOG INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- TIMETABLE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_timetables_branch_id ON timetables(branch_id);
CREATE INDEX IF NOT EXISTS idx_timetables_course_id ON timetables(course_id);
CREATE INDEX IF NOT EXISTS idx_timetables_day_of_week ON timetables(day_of_week);

-- ============================================
-- STUDENT DOCUMENT INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_branch_id ON student_documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_doc_type ON student_documents(doc_type);

-- ============================================
-- BATCH INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_batches_branch_id ON batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_batches_course_id ON batches(course_id);
CREATE INDEX IF NOT EXISTS idx_batches_is_active ON batches(is_active);
CREATE INDEX IF NOT EXISTS idx_batches_start_date ON batches(start_date);

-- ============================================
-- BATCH STUDENTS INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_batch_students_batch_id ON batch_students(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student_id ON batch_students(student_id);

-- ============================================
-- WEBHOOK INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_webhooks_branch_id ON webhooks(branch_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);

-- ============================================
-- SETTINGS INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_settings_branch_id ON settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- ============================================
-- FULL TEXT SEARCH INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_name_search ON students USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_tests_title_search ON tests USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_study_materials_title_search ON study_materials USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_courses_title_search ON courses USING gin(to_tsvector('english', title));

-- ============================================
-- PARTIAL INDEXES FOR COMMON QUERIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_active ON students(branch_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(branch_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_complaints_pending ON complaints(branch_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tests_scheduled ON tests(branch_id) WHERE is_active = true AND scheduled_at IS NOT NULL;