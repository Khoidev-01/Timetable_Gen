from pathlib import Path
from xml.etree import ElementTree

import fitz


OUT = Path(__file__).resolve().parent


def esc(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def base(width, height, title):
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">')
    lines.append('<style>text{font-family:"Segoe UI",Arial,sans-serif;fill:#111827}.title{font-size:25px;font-weight:700}.label{font-size:16px;font-weight:600}.small{font-size:13px}.field{font-size:12px}.muted{fill:#6b7280}</style>')
    lines.append('<defs>')
    lines.append('<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#94a3b8" flood-opacity=".25"/></filter>')
    lines.append('<marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#2563eb"/></marker>')
    lines.append('<marker id="arrow-gray" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#64748b"/></marker>')
    lines.append('</defs>')
    lines.append(f'<rect width="{width}" height="{height}" fill="#ffffff"/>')
    lines.append(f'<text x="{width/2}" y="38" text-anchor="middle" class="title">{esc(title)}</text>')
    return lines


def multiline(lines, x, y, values, css="small", anchor="middle", step=18):
    lines.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{css}">')
    for i, value in enumerate(values):
        dy = 0 if i == 0 else step
        lines.append(f'<tspan x="{x}" dy="{dy}">{esc(value)}</tspan>')
    lines.append('</text>')


def actor(lines, x, y, label):
    lines.append(f'<g stroke="#111827" stroke-width="3" fill="none">')
    lines.append(f'<circle cx="{x}" cy="{y}" r="18" fill="#eff6ff"/>')
    lines.append(f'<line x1="{x}" y1="{y+18}" x2="{x}" y2="{y+78}"/>')
    lines.append(f'<line x1="{x-30}" y1="{y+43}" x2="{x+30}" y2="{y+43}"/>')
    lines.append(f'<line x1="{x}" y1="{y+78}" x2="{x-28}" y2="{y+122}"/>')
    lines.append(f'<line x1="{x}" y1="{y+78}" x2="{x+28}" y2="{y+122}"/>')
    lines.append('</g>')
    multiline(lines, x, y+150, [label], "label")


def use_case(lines, cx, cy, labels, fill="#eff6ff"):
    lines.append(f'<ellipse cx="{cx}" cy="{cy}" rx="210" ry="38" fill="{fill}" stroke="#93c5fd" stroke-width="2" filter="url(#shadow)"/>')
    start = cy - (len(labels)-1)*9 + 5
    multiline(lines, cx, start, labels, "label", step=19)


def assoc(lines, x1, y1, x2, y2, dashed=False, label=None):
    dash = ' stroke-dasharray="7 5"' if dashed else ""
    marker = ' marker-end="url(#arrow-gray)"' if dashed else ""
    lines.append(f'<path d="M{x1},{y1} L{x2},{y2}" fill="none" stroke="#64748b" stroke-width="1.8"{dash}{marker}/>')
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        lines.append(f'<rect x="{mx-48}" y="{my-14}" width="96" height="20" rx="4" fill="#ffffff" opacity=".96"/>')
        lines.append(f'<text x="{mx}" y="{my+1}" text-anchor="middle" class="small muted">{esc(label)}</text>')


def make_use_case(filename, title, actor_name, cases, support_name, support_links):
    width, height = 1200, 1040
    lines = base(width, height, title)
    lines.append('<rect x="255" y="72" width="690" height="900" rx="16" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" stroke-dasharray="9 6"/>')
    lines.append('<text x="282" y="104" class="label" fill="#334155">Hệ thống MiKiTimetable</text>')
    actor(lines, 110, 440, actor_name)
    actor(lines, 1080, 440, support_name)
    centers = []
    for index, labels in enumerate(cases):
        cy = 150 + index * 92
        centers.append(cy)
        use_case(lines, 600, cy, labels, "#eff6ff" if index % 2 == 0 else "#f0fdf4")
        assoc(lines, 140, 483, 390, cy)
    for index in support_links:
        assoc(lines, 1048, 483, 810, centers[index], dashed=True)
    lines.append('<g transform="translate(300,1000)"><line x1="0" y1="0" x2="38" y2="0" stroke="#64748b" stroke-width="2"/><text x="48" y="5" class="small muted">Tương tác trực tiếp</text><line x1="240" y1="0" x2="278" y2="0" stroke="#64748b" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#arrow-gray)"/><text x="288" y="5" class="small muted">Phối hợp/duyệt</text></g>')
    lines.append('</svg>')
    write(filename, lines)


def entity(lines, x, y, w, name, fields, fill="#eff6ff"):
    header_h, row_h = 38, 22
    h = header_h + row_h * len(fields) + 12
    lines.append(f'<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.6"/>')
    lines.append(f'<path d="M{x+8},{y} H{x+w-8} Q{x+w},{y} {x+w},{y+8} V{y+header_h} H{x} V{y+8} Q{x},{y} {x+8},{y}" fill="{fill}" stroke="#cbd5e1" stroke-width="1.2"/>')
    lines.append(f'<text x="{x+w/2}" y="{y+25}" text-anchor="middle" class="label">{esc(name)}</text>')
    for i, value in enumerate(fields):
        lines.append(f'<text x="{x+12}" y="{y+header_h+19+i*row_h}" class="field">{esc(value)}</text>')
    lines.append('</g>')
    return h


def relation(lines, points, left_card="1", right_card="N", dashed=False):
    dash = ' stroke-dasharray="7 5"' if dashed else ""
    path = " ".join(("M" if i == 0 else "L") + f"{x},{y}" for i, (x, y) in enumerate(points))
    lines.append(f'<path d="{path}" fill="none" stroke="#2563eb" stroke-width="2"{dash} marker-end="url(#arrow)"/>')
    x1, y1 = points[0]
    x2, y2 = points[-1]
    lines.append(f'<text x="{x1+8}" y="{y1-7}" class="small" fill="#2563eb">{esc(left_card)}</text>')
    lines.append(f'<text x="{x2-18}" y="{y2-7}" class="small" fill="#2563eb">{esc(right_card)}</text>')


def make_core_erd():
    width, height = 1600, 1080
    lines = base(width, height, "ERD CSDL lõi – cấu hình, tài nguyên và phân công")
    # Edges are drawn before entity boxes so routes never cover labels.
    relation(lines, [(260,190),(360,190)])
    relation(lines, [(500,320),(500,655),(740,655),(740,760)])
    relation(lines, [(180,535),(180,700),(650,700),(650,800)], right_card="N")
    relation(lines, [(500,557),(500,720),(715,720),(715,800)], right_card="N")
    relation(lines, [(860,535),(860,720),(790,720),(790,800)], right_card="N")
    relation(lines, [(1220,535),(1220,700),(840,700),(840,800)], left_card="0..1", right_card="N")
    relation(lines, [(865,298),(865,340),(500,340),(500,380)], left_card="0..1", right_card="1")
    entity(lines, 40, 115, 220, "AcademicYear", ["PK id: uuid", "name", "start_date", "end_date", "weeks", "status"], "#dbeafe")
    entity(lines, 360, 100, 280, "Semester", ["PK id: uuid", "FK year_id", "name", "term_order", "start_date", "end_date", "is_current"], "#dbeafe")
    entity(lines, 730, 100, 270, "User", ["PK id: uuid", "username (UQ)", "password_hash", "role", "FK teacher_profile_id"], "#f3e8ff")
    entity(lines, 1110, 110, 330, "Configuration", ["ConstraintSetting", "FixedPeriodRule", "CurriculumCombination", "(các bảng luật độc lập)"], "#f3e8ff")
    entity(lines, 55, 380, 250, "Class", ["PK id: uuid", "name", "grade_level", "main_session", "FK fixed_room_id", "FK homeroom_teacher_id"], "#fff7ed")
    entity(lines, 370, 380, 260, "Teacher", ["PK id: uuid", "code (UQ)", "full_name", "major_subject", "max_periods_per_week", "mobility_weight", "status"], "#fff7ed")
    entity(lines, 740, 380, 240, "Subject", ["PK id: int", "code (UQ)", "name", "color", "is_special", "is_practice"], "#fff7ed")
    entity(lines, 1105, 380, 230, "Room", ["PK id: int", "name", "type", "floor", "capacity"], "#fff7ed")
    entity(lines, 590, 800, 300, "TeachingAssignment", ["PK id: uuid", "FK semester_id", "FK class_id", "FK teacher_id", "FK subject_id", "total_periods", "period_type", "required_room_type", "block_config"], "#dcfce7")
    lines.append('<g transform="translate(60,1030)"><line x1="0" y1="0" x2="45" y2="0" stroke="#2563eb" stroke-width="2" marker-end="url(#arrow)"/><text x="58" y="5" class="small muted">Quan hệ khóa ngoại; nhãn 1/N thể hiện lực lượng</text><text x="650" y="5" class="small muted">PK: khóa chính · FK: khóa ngoại · UQ: duy nhất</text></g>')
    lines.append('</svg>')
    write("erd-core", lines)


def make_ops_erd():
    width, height = 1600, 1200
    lines = base(width, height, "ERD CSDL vận hành – thời khóa biểu, thay đổi và yêu cầu")
    relation(lines, [(260,180),(390,180)], right_card="N")
    relation(lines, [(690,190),(810,190)], right_card="N")
    relation(lines, [(540,330),(540,440),(500,440),(500,520)], right_card="N")
    relation(lines, [(150,330),(150,450),(880,450),(880,520)], right_card="N")
    relation(lines, [(150,330),(150,970),(40,970)], right_card="N")
    relation(lines, [(150,330),(150,1080),(830,1080)], right_card="N")
    relation(lines, [(1080,390),(1080,470),(990,470),(990,520)], left_card="1", right_card="N", dashed=True)
    relation(lines, [(1060,390),(1060,1010),(990,1010)], left_card="1", right_card="N", dashed=True)
    entity(lines, 40, 110, 220, "Semester", ["PK id", "FK year_id", "name", "start_date", "end_date"], "#dbeafe")
    entity(lines, 390, 100, 300, "GeneratedTimetable", ["PK id", "FK semester_id", "name", "is_official", "fitness_score", "public_token", "created_at"], "#dcfce7")
    entity(lines, 810, 90, 340, "TimetableSlot", ["PK id", "FK timetable_id", "FK class_id", "FK subject_id", "FK teacher_id", "FK room_id", "day · period · week", "is_locked", "UQ lớp/GV/phòng theo thời điểm"], "#dcfce7")
    entity(lines, 350, 520, 300, "TimetableChangeLog", ["PK id", "FK timetable_id", "slot_id", "actor_id", "action", "before / after (JSON)", "reverted", "created_at"], "#f3e8ff")
    entity(lines, 790, 520, 310, "ScheduleOverlay", ["PK id", "FK semester_id", "type", "scope / scope_ref", "date_from / date_to", "priority", "payload (JSON)"], "#f3e8ff")
    entity(lines, 1240, 510, 270, "KnowledgeChunk", ["PK id", "source", "article", "title", "body", "search_text"], "#fef2f2")
    entity(lines, 40, 850, 290, "TeacherBusyRequest", ["PK id", "FK teacher_id", "FK semester_id", "week/day/period", "reason", "status", "reviewed_by"], "#fff7ed")
    entity(lines, 400, 860, 300, "TeacherConstraint", ["PK id", "FK teacher_id", "day/period/session", "type: BUSY/AVOID/PREFER"], "#fff7ed")
    entity(lines, 830, 840, 320, "SwapRequest", ["PK id", "FK semester_id", "FK requester_teacher_id", "FK partner_teacher_id", "requester_slot_id", "partner_slot_id", "status", "overlay_id"], "#fff7ed")
    entity(lines, 1240, 850, 270, "Notification", ["PK id", "user_id", "category", "title", "message", "metadata", "is_read", "created_at"], "#fef2f2")
    lines.append('<g transform="translate(60,1150)"><line x1="0" y1="0" x2="45" y2="0" stroke="#2563eb" stroke-width="2" marker-end="url(#arrow)"/><text x="58" y="5" class="small muted">Quan hệ Prisma trực tiếp</text><line x1="330" y1="0" x2="375" y2="0" stroke="#2563eb" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#arrow)"/><text x="388" y="5" class="small muted">Liên kết logic qua ID/payload</text></g>')
    lines.append('</svg>')
    write("erd-operations", lines)


def write(name, lines):
    svg = "\n".join(lines)
    ElementTree.fromstring(svg)
    svg_path = OUT / f"{name}.svg"
    png_path = OUT / f"{name}.png"
    svg_path.write_text(svg, encoding="utf-8")
    document = fitz.open(stream=svg.encode("utf-8"), filetype="svg")
    page = document[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(png_path)
    print(f"{svg_path.name} -> {png_path.name} ({pix.width}x{pix.height})")


make_use_case(
    "usecase-admin",
    "Sơ đồ use case – Quản trị viên",
    "Quản trị viên",
    [
        ["Đăng nhập và", "quản lý tài khoản"],
        ["Quản lý năm/học kỳ,", "lớp, GV, môn, phòng"],
        ["Import/Export và", "phân công chuyên môn"],
        ["Cấu hình ràng buộc", "và tiết cố định"],
        ["Kiểm tra dữ liệu và", "chạy thuật toán xếp lịch"],
        ["So sánh phương án,", "kéo-thả và khóa tiết"],
        ["Duyệt lịch bận,", "dạy thay và đổi tiết"],
        ["Công bố, xuất lịch", "và xem báo cáo"],
        ["Theo dõi thông báo", "và nhật ký thay đổi"],
    ],
    "Giáo viên",
    [6, 7, 8],
)

make_use_case(
    "usecase-teacher",
    "Sơ đồ use case – Giáo viên",
    "Giáo viên",
    [
        ["Đăng nhập"],
        ["Xem dashboard và", "lịch dạy hôm nay"],
        ["Xem thời khóa biểu", "cá nhân theo tuần"],
        ["Đăng ký lịch bận", "và nguyện vọng"],
        ["Theo dõi hoặc hủy", "yêu cầu đang chờ"],
        ["Đề xuất / phản hồi", "đổi tiết"],
        ["Nhận và đọc", "thông báo"],
        ["Hỏi trợ lý AI"],
        ["Đổi mật khẩu"],
    ],
    "Quản trị viên",
    [3, 4, 5, 6],
)

make_core_erd()
make_ops_erd()
