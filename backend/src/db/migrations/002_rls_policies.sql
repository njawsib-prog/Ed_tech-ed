-- EdTech Platform - Row Level Security Policies
-- Run this AFTER 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUPER ADMIN POLICIES (Full access to all tables)
-- ============================================

CREATE POLICY "super_admin_full_access_on_branches" ON branches
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_users" ON users
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_admins" ON admins
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_students" ON students
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_tests" ON tests
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_payments" ON payments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_results" ON results
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "super_admin_full_access_on_courses" ON courses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- ============================================
-- BRANCH ADMIN POLICIES (Branch-scoped access)
-- ============================================

-- Branches: Can only see their own branch
CREATE POLICY "branch_admin_read_own_branch" ON branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = branches.id)
  );

CREATE POLICY "branch_admin_update_own_branch" ON branches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = branches.id)
  );

-- Students: Can only manage students in their branch
CREATE POLICY "branch_admin_access_students" ON students
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = students.branch_id)
  );

-- Tests: Can only manage tests in their branch
CREATE POLICY "branch_admin_access_tests" ON tests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = tests.branch_id)
  );

-- Questions: Can only access questions for tests in their branch
CREATE POLICY "branch_admin_access_questions" ON questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      JOIN users u ON u.branch_id = t.branch_id
      WHERE t.id = questions.test_id AND u.id = auth.uid() AND u.role = 'branch_admin'
    )
  );

-- Test Assignments: Branch scoped
CREATE POLICY "branch_admin_access_test_assignments" ON test_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN users u ON u.branch_id = s.branch_id
      WHERE s.id = test_assignments.student_id AND u.id = auth.uid() AND u.role = 'branch_admin'
    )
  );

-- Results: Branch scoped
CREATE POLICY "branch_admin_access_results" ON results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN users u ON u.branch_id = s.branch_id
      WHERE s.id = results.student_id AND u.id = auth.uid() AND u.role = 'branch_admin'
    )
  );

-- Study Materials: Branch scoped
CREATE POLICY "branch_admin_access_materials" ON study_materials
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = study_materials.branch_id)
  );

-- Notifications: Branch scoped
CREATE POLICY "branch_admin_access_notifications" ON notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = notifications.branch_id)
  );

-- Complaints: Branch scoped
CREATE POLICY "branch_admin_access_complaints" ON complaints
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = complaints.branch_id)
  );

-- Complaint Replies: Branch scoped
CREATE POLICY "branch_admin_access_complaint_replies" ON complaint_replies
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM complaints c
      JOIN users u ON u.branch_id = c.branch_id
      WHERE c.id = complaint_replies.complaint_id AND u.id = auth.uid() AND u.role = 'branch_admin'
    )
  );

-- Feedback: Branch scoped
CREATE POLICY "branch_admin_access_feedback" ON feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = feedback.branch_id)
  );

-- Payments: Branch scoped
CREATE POLICY "branch_admin_access_payments" ON payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = payments.branch_id)
  );

-- Attendance: Branch scoped
CREATE POLICY "branch_admin_access_attendance" ON attendance
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = attendance.branch_id)
  );

-- Timetables: Branch scoped
CREATE POLICY "branch_admin_access_timetables" ON timetables
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = timetables.branch_id)
  );

-- Student Documents: Branch scoped
CREATE POLICY "branch_admin_access_documents" ON student_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = student_documents.branch_id)
  );

-- Batches: Branch scoped
CREATE POLICY "branch_admin_access_batches" ON batches
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = batches.branch_id)
  );

-- Batch Students: Branch scoped
CREATE POLICY "branch_admin_access_batch_students" ON batch_students
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM batches b
      JOIN users u ON u.branch_id = b.branch_id
      WHERE b.id = batch_students.batch_id AND u.id = auth.uid() AND u.role = 'branch_admin'
    )
  );

-- Webhooks: Branch scoped
CREATE POLICY "branch_admin_access_webhooks" ON webhooks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = webhooks.branch_id)
  );

-- Settings: Branch scoped
CREATE POLICY "branch_admin_access_settings" ON settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = settings.branch_id)
  );

-- Audit Logs: Branch scoped (read only)
CREATE POLICY "branch_admin_read_audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'branch_admin' AND branch_id = audit_logs.branch_id)
  );

-- Courses: Read only for branch admins
CREATE POLICY "branch_admin_read_courses" ON courses
  FOR SELECT TO authenticated
  USING (is_active = true);

-- ============================================
-- STUDENT POLICIES (Own data only)
-- ============================================

-- Students: Can only read/update own profile
CREATE POLICY "student_read_own_profile" ON students
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student' AND user_id = students.user_id)
  );

CREATE POLICY "student_update_own_profile" ON students
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student' AND user_id = students.user_id)
  );

-- Test Assignments: Can only see own assignments
CREATE POLICY "student_read_own_assignments" ON test_assignments
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "student_update_own_assignments" ON test_assignments
  FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Results: Can only see own results
CREATE POLICY "student_read_own_results" ON results
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Tests: Can read assigned tests
CREATE POLICY "student_read_assigned_tests" ON tests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_assignments ta
      JOIN students s ON s.id = ta.student_id
      WHERE ta.test_id = tests.id AND s.user_id = auth.uid()
    )
  );

-- Questions: Can read questions for assigned tests
CREATE POLICY "student_read_test_questions" ON questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_assignments ta
      JOIN students s ON s.id = ta.student_id
      JOIN tests t ON t.id = questions.test_id
      WHERE ta.test_id = t.id AND s.user_id = auth.uid() AND ta.is_completed = false
    )
  );

-- Study Materials: Can read materials for enrolled course
CREATE POLICY "student_read_materials" ON study_materials
  FOR SELECT TO authenticated
  USING (
    is_active = true AND
    (
      branch_id = (SELECT branch_id FROM students WHERE user_id = auth.uid())
      OR branch_id IS NULL
    )
  );

-- Notifications: Can read notifications for self or all
CREATE POLICY "student_read_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM students WHERE user_id = auth.uid())
    AND (
      target_type = 'all'
      OR (target_type = 'student' AND target_id = (SELECT id FROM students WHERE user_id = auth.uid()))
      OR (target_type = 'course' AND target_id = (SELECT course_id FROM students WHERE user_id = auth.uid()))
    )
  );

-- Notification Reads: Own records only
CREATE POLICY "student_manage_own_notification_reads" ON notification_reads
  FOR ALL TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Complaints: Can manage own complaints
CREATE POLICY "student_manage_own_complaints" ON complaints
  FOR ALL TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Complaint Replies: Can read replies to own complaints
CREATE POLICY "student_read_complaint_replies" ON complaint_replies
  FOR SELECT TO authenticated
  USING (
    complaint_id IN (
      SELECT id FROM complaints WHERE student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

-- Feedback: Can create and read own feedback
CREATE POLICY "student_manage_own_feedback" ON feedback
  FOR ALL TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Payments: Can read own payments
CREATE POLICY "student_read_own_payments" ON payments
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Attendance: Can read own attendance
CREATE POLICY "student_read_own_attendance" ON attendance
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Timetables: Can read branch timetable
CREATE POLICY "student_read_timetable" ON timetables
  FOR SELECT TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM students WHERE user_id = auth.uid())
  );

-- Student Documents: Can read own documents
CREATE POLICY "student_read_own_documents" ON student_documents
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Batches: Can read own batches
CREATE POLICY "student_read_own_batches" ON batches
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT batch_id FROM batch_students WHERE student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- SERVICE ROLE BYPASS POLICY
-- For backend API operations
-- ============================================

-- Allow service role to bypass RLS
-- This is handled by using the service_role key in backend
-- RLS is enforced at the application level for service role operations