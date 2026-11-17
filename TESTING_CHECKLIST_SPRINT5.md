# Sprint 5 Frontend Testing Checklist

## Environment Setup
- [ ] Backend running on `http://localhost:3000`
- [ ] Frontend running on `http://localhost:5173`
- [ ] PostgreSQL with migrations applied
- [ ] Test accounts created:
  - Admin account (email: admin@test.com, password: Admin123!)
  - Manager account (email: manager@test.com, password: Manager123!)
  - Agent account (email: agent@test.com, password: Agent123!)

---

## Test Case 1: Role-Based Button Visibility

### 1.1 Login as Admin
```
Email: admin@test.com
Password: Admin123!
```
- [ ] Navigate to Unified Inbox
- [ ] Click on any ticket to open details
- [ ] **Verify**: "Phân công Agent" button is ENABLED (clickable) in detail header
- [ ] **Verify**: "Chuyển phân công" button is ENABLED (clickable) in detail sidebar

### 1.2 Login as Manager
```
Email: manager@test.com
Password: Manager123!
```
- [ ] Navigate to Unified Inbox
- [ ] Click on any ticket to open details
- [ ] **Verify**: "Phân công Agent" button is ENABLED (clickable) in detail header
- [ ] **Verify**: "Chuyển phân công" button is ENABLED (clickable) in detail sidebar

### 1.3 Login as Agent
```
Email: agent@test.com
Password: Agent123!
```
- [ ] Navigate to Unified Inbox
- [ ] Click on any ticket to open details
- [ ] **Verify**: "Phân công Agent" button is DISABLED (gray, not clickable) in detail header
- [ ] **Verify**: "Chuyển phân công" button is DISABLED (gray, not clickable) in detail sidebar
- [ ] **Verify**: Hovering over button shows tooltip: "Chỉ admin/manager mới có quyền phân công"

---

## Test Case 2: Manual Assignment Flow

### 2.1 Admin Manual Assignment
```
Login: admin@test.com
```
- [ ] Open unassigned ticket (shows "Chưa phân công")
- [ ] Click "Phân công Agent" button
- [ ] **Verify Modal Opens**:
  - [ ] Title: "Phân công Ticket"
  - [ ] Radio buttons visible: "Thủ công" (selected) and "Tự động (Round-robin)"
  - [ ] Agent dropdown visible with list of active agents
  - [ ] Cancel and "Xác nhận phân công" buttons present

### 2.2 Select Agent and Confirm
- [ ] Click Agent dropdown
- [ ] **Verify**: All active agents listed (minimum 2 test agents)
- [ ] Select first agent (e.g., "Võ Ngọc Phú")
- [ ] Click "Xác nhận phân công"
- [ ] **Verify**:
  - [ ] Modal closes
  - [ ] Ticket now shows assignee in detail panel
  - [ ] Ticket list updates with new assignee avatar + name

### 2.3 Reassign to Different Agent
- [ ] Click "Chuyển phân công" button
- [ ] Modal opens again
- [ ] Select different agent
- [ ] Click "Xác nhận phân công"
- [ ] **Verify**: Ticket immediately shows new agent

---

## Test Case 3: Auto Round-Robin Assignment

### 3.1 Switch to Auto Mode
```
Login: admin@test.com
```
- [ ] Open unassigned ticket
- [ ] Click "Phân công Agent"
- [ ] **In Modal**:
  - [ ] Click "Tự động (Round-robin)" radio button
  - [ ] **Verify**: Agent dropdown disappears
  - [ ] **Verify**: Message appears: "🔄 Hệ thống sẽ tự động chọn Agent tiếp theo theo thứ tự Round-robin"
  - [ ] "Xác nhận phân công" button remains enabled

### 3.2 Confirm Auto Assignment
- [ ] Click "Xác nhận phân công"
- [ ] **Verify**:
  - [ ] Modal closes
  - [ ] Ticket shows assigned agent (should be next in round-robin sequence)
  - [ ] Success notification/no errors

### 3.3 Test Round-Robin Sequence
- [ ] Create 3+ tickets without assignment
- [ ] For each ticket, use auto assignment mode
- [ ] **Verify Assignment Sequence**:
  - Ticket 1 → Agent A
  - Ticket 2 → Agent B (or next in sequence)
  - Ticket 3 → Agent C (or next in sequence)
  - Ticket 4 → Agent A (cycles back)

---

## Test Case 4: Cross-Session Synchronization

### 4.1 Two Browser Sessions Setup
**Session 1**: Admin account (Chrome/Firefox)
**Session 2**: Admin account (different browser/tab)
- [ ] Both sessions logged in and showing Unified Inbox
- [ ] Both sessions viewing same ticket list

### 4.2 Reassign from Session 1
- [ ] In Session 1, open ticket "TK-001"
- [ ] Assign to "Agent A"
- [ ] **Verify**: Session 1 shows "Agent A"

### 4.3 Verify Sync in Session 2
- [ ] Switch to Session 2
- [ ] **Verify** (without manual refresh):
  - [ ] After polling interval (5 seconds), ticket "TK-001" shows "Agent A"
  - [ ] Ticket list updates assignee avatar
  - [ ] Detail panel shows "Agent A"

### 4.4 Reassign from Session 2 to Different Agent
- [ ] In Session 2, open ticket "TK-001"
- [ ] Change assignment to "Agent B"
- [ ] **Verify**: Session 2 shows "Agent B"

### 4.5 Verify Reverse Sync
- [ ] Switch to Session 1
- [ ] **Verify** (without manual refresh):
  - [ ] After polling interval (5 seconds), ticket "TK-001" shows "Agent B" (not "Agent A" from earlier)

---

## Test Case 5: Error Handling

### 5.1 No Active Agents
- [ ] Manually deactivate all agents in database
- [ ] Login as admin
- [ ] Open ticket
- [ ] Click "Phân công Agent"
- [ ] **Verify**:
  - [ ] Manual mode: Shows "Không có Agent đang hoạt động"
  - [ ] Auto mode: Shows error message

### 5.2 Assignment to Already-Assigned Ticket (Policy Check)
- [ ] Open already-assigned ticket
- [ ] Try to reassign using auto mode
- [ ] **Verify**: Either:
  - [ ] Reassignment allowed (shows new agent)
  - [ ] Or error message: "Ticket đã được phân công"

### 5.3 Offline Assignment Attempt
- [ ] Disconnect network
- [ ] Try to open assignment modal
- [ ] **Verify**: Error message or retry indication

---

## Test Case 6: UI/UX Validation

### 6.1 Modal Layout
- [ ] Mode selector radio buttons display correctly
- [ ] Conditional elements show/hide based on mode
- [ ] Text is readable and Vietnamese translations correct

### 6.2 Button States
- [ ] "Xác nhận phân công" disabled when:
  - [ ] No agent selected (manual mode)
  - [ ] While loading
- [ ] "Xác nhận phân công" enabled when:
  - [ ] Agent selected (manual mode)
  - [ ] Auto mode selected

### 6.3 Visual Feedback
- [ ] Loading state shows "Đang xử lý..." text on button
- [ ] Error messages display in red
- [ ] Success reflected immediately in ticket display

---

## Test Case 7: Filtering & List Updates

### 7.1 "Chưa phân công" Filter
- [ ] In Unified Inbox filter tabs, click "Chưa phân công"
- [ ] Assign a ticket
- [ ] **Verify**: Ticket disappears from filter (correctly removed)
- [ ] Count updates: -1

### 7.2 "Của tôi" Filter
```
Login: admin@test.com
Assume agent name is "Võ Ngọc Phú"
```
- [ ] Click "Của tôi" filter (shows tickets assigned to current user)
- [ ] Assign a ticket to self using manual assignment
- [ ] **Verify**: Ticket appears in "Của tôi" filter

---

## Database Verification

### 7.1 Check Migration
```sql
-- Run on test database
SELECT * FROM "round_robin_state" LIMIT 1;
-- Should return: last_assigned_agent_id, updated_at
```
- [ ] Migration applied: `1794700800000-AddRoundRobinState.ts`
- [ ] Table `round_robin_state` exists
- [ ] Columns: `last_assigned_agent_id`, `updated_at`

### 7.2 Verify Assignments
```sql
-- After manual assignment
SELECT ticket_id, assigned_agent_id, created_at FROM ticket WHERE ticket_id = 'TK-001';
-- Should show assigned_agent_id populated
```
- [ ] `assigned_agent_id` field populated after assignment
- [ ] Timestamp updated correctly

---

## Performance Checks

- [ ] Modal opens within 1 second
- [ ] Agent dropdown loads within 500ms
- [ ] Assignment API response < 500ms
- [ ] Cross-session polling updates within 5 seconds

---

## Sign-Off

**Tester Name**: ___________________
**Date**: ___________________
**Overall Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

**Issues Found**:
- Issue 1: ___________________
- Issue 2: ___________________
- Issue 3: ___________________

**Notes**:
____________________________________________________________
____________________________________________________________

---

## Appendix: Quick Commands

### Database Setup
```bash
# Apply migration
npm run typeorm -- migration:run

# Verify migration
psql -U postgres -d helpdesk_db -c "SELECT * FROM round_robin_state;"
```

### Reset Test Data
```bash
# Reset assignments to unassigned
UPDATE ticket SET assigned_agent_id = NULL WHERE ticket_code LIKE 'TK-%';
TRUNCATE round_robin_state;
```

### Backend Restart (if needed)
```bash
npm run start:dev
```

### Frontend Development
```bash
npm run dev
```

---

## Reference Links

- **Figma Base 5**: Assignment Modal Design
- **Backend API Docs**: `/tickets/:id/assign-round-robin` endpoint
- **Sprint 5 Requirements**: AGENTS.md - Phân công vai trò section
