const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'testuser',
    password: '1234',
    database: 'testdb',
    dateStrings: true
});

conn.connect((err) => {
    if (err) {
        console.error('DB 연결 실패:', err);
        return;
    }
    console.log('DB 연결 성공');
});

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readTemplate(fileName) {
    const filePath = path.join(__dirname, 'templates', fileName);
    return fs.readFileSync(filePath, 'utf8');
}

function renderTemplate(template, data) {
    let html = template;

    for (const key in data) {
        const pattern = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(pattern, data[key]);
    }

    return html;
}

function sendMessagePage(res, title, message) {
    const template = readTemplate('material-message.html');
    const html = renderTemplate(template, {
        title: escapeHtml(title),
        message: escapeHtml(message)
    });
    res.send(html);
}

function formatMoney(value) {
    return Number(value).toLocaleString('ko-KR');
}

function getMaterialStatusSelectedMap(status) {
    return {
        selected_status_normal: status === '정상' ? 'selected' : '',
        selected_status_shortage: status === '부족' ? 'selected' : '',
        selected_status_ordering: status === '발주중' ? 'selected' : '',
        selected_status_discontinued: status === '단종' ? 'selected' : ''
    };
}

app.get('/', (req, res) => {
    res.redirect('/material/list');
});

app.get('/material/list', (req, res) => {
    const sql = `
        SELECT
            material_id,
            material_code,
            material_name,
            category,
            unit,
            stock_qty,
            material_status,
            unit_price,
            DATE_FORMAT(inbound_date, '%Y-%m-%d') AS inbound_date
        FROM material
        ORDER BY material_id DESC
    `;

    conn.query(sql, (err, rows) => {
        if (err) {
            console.error('자재 목록 조회 실패:', err);
            return sendMessagePage(res, '조회 실패', '자재 목록 조회 중 오류가 발생했습니다.');
        }

        let tableSection = '';

        if (rows.length === 0) {
            tableSection = `<div class="empty-box">등록된 자재 정보가 없습니다.</div>`;
        } else {
            let rowsHtml = '';

            for (let i = 0; i < rows.length; i++) {
                rowsHtml += `
                    <tr>
                        <td>${rows[i].material_id}</td>
                        <td>${escapeHtml(rows[i].material_code)}</td>
                        <td class="title-cell">
                            <a class="title-link" href="/material/detail/${rows[i].material_id}">${escapeHtml(rows[i].material_name)}</a>
                        </td>
                        <td>${escapeHtml(rows[i].category)}</td>
                        <td>${escapeHtml(rows[i].unit)}</td>
                        <td>${escapeHtml(String(rows[i].stock_qty))}</td>
                        <td>${escapeHtml(rows[i].material_status)}</td>
                        <td class="money">${formatMoney(rows[i].unit_price)}원</td>
                        <td>${rows[i].inbound_date}</td>
                        <td>
                            <a class="action-link view-link" href="/material/detail/${rows[i].material_id}">조회</a>
                        </td>
                        <td>
                            <a class="action-link edit-link" href="/material/edit/${rows[i].material_id}">수정</a>
                        </td>
                        <td>
                            <form class="inline-form" action="/material/delete/${rows[i].material_id}" method="post" onsubmit="return confirm('정말 삭제하시겠습니까?');">
                                <button class="delete-btn" type="submit">삭제</button>
                            </form>
                        </td>
                    </tr>
                `;
            }

            tableSection = `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="col-id">번호</th>
                                <th class="col-code">자재코드</th>
                                <th class="col-name">자재명</th>
                                <th class="col-category">분류</th>
                                <th class="col-unit">단위</th>
                                <th class="col-stock">현재고</th>
                                <th class="col-status">상태</th>
                                <th class="col-price">단가</th>
                                <th class="col-date">최근입고일</th>
                                <th class="col-action">조회</th>
                                <th class="col-action">수정</th>
                                <th class="col-action">삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const template = readTemplate('material-list.html');
        const html = renderTemplate(template, {
            table_section: tableSection
        });

        res.send(html);
    });
});

app.get('/material/write', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'material-write.html'));
});

app.post('/material/write', (req, res) => {
    const {
        material_code,
        material_name,
        category,
        specification,
        unit,
        unit_price,
        stock_qty,
        safety_stock,
        supplier_name,
        warehouse_location,
        inbound_date,
        material_status,
        manager_name,
        manager_phone,
        note
    } = req.body;

    const sql = `
        INSERT INTO material (
            material_code,
            material_name,
            category,
            specification,
            unit,
            unit_price,
            stock_qty,
            safety_stock,
            supplier_name,
            warehouse_location,
            inbound_date,
            material_status,
            manager_name,
            manager_phone,
            note,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'))
    `;

    conn.query(sql, [
        material_code,
        material_name,
        category,
        specification,
        unit,
        unit_price,
        stock_qty,
        safety_stock,
        supplier_name,
        warehouse_location,
        inbound_date,
        material_status,
        manager_name,
        manager_phone,
        note
    ], (err) => {
        if (err) {
            console.error('자재 정보 저장 실패:', err);
            return sendMessagePage(res, '저장 실패', '자재 정보 저장 중 오류가 발생했습니다.');
        }

        res.redirect('/material/list');
    });
});

app.get('/material/detail/:id', (req, res) => {
    const materialId = req.params.id;

    const sql = `
        SELECT
            material_id,
            material_code,
            material_name,
            category,
            specification,
            unit,
            unit_price,
            stock_qty,
            safety_stock,
            supplier_name,
            warehouse_location,
            DATE_FORMAT(inbound_date, '%Y-%m-%d') AS inbound_date,
            material_status,
            manager_name,
            manager_phone,
            note,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
        FROM material
        WHERE material_id = ?
    `;

    conn.query(sql, [materialId], (err, rows) => {
        if (err) {
            console.error('자재 상세 조회 실패:', err);
            return sendMessagePage(res, '조회 실패', '자재 정보 조회 중 오류가 발생했습니다.');
        }

        if (rows.length === 0) {
            return sendMessagePage(res, '조회 실패', '해당 자재 정보가 존재하지 않습니다.');
        }

        const row = rows[0];
        const template = readTemplate('material-detail.html');
        const html = renderTemplate(template, {
            material_id: String(row.material_id),
            material_code: escapeHtml(row.material_code),
            material_name: escapeHtml(row.material_name),
            category: escapeHtml(row.category),
            specification: escapeHtml(row.specification),
            unit: escapeHtml(row.unit),
            unit_price: formatMoney(row.unit_price),
            stock_qty: escapeHtml(String(row.stock_qty)),
            safety_stock: escapeHtml(String(row.safety_stock)),
            supplier_name: escapeHtml(row.supplier_name),
            warehouse_location: escapeHtml(row.warehouse_location),
            inbound_date: row.inbound_date,
            material_status: escapeHtml(row.material_status),
            manager_name: escapeHtml(row.manager_name),
            manager_phone: escapeHtml(row.manager_phone),
            note: escapeHtml(row.note),
            created_at: row.created_at
        });

        res.send(html);
    });
});

app.get('/material/edit/:id', (req, res) => {
    const materialId = req.params.id;

    const sql = `
        SELECT
            material_id,
            material_code,
            material_name,
            category,
            specification,
            unit,
            unit_price,
            stock_qty,
            safety_stock,
            supplier_name,
            warehouse_location,
            DATE_FORMAT(inbound_date, '%Y-%m-%d') AS inbound_date,
            material_status,
            manager_name,
            manager_phone,
            note
        FROM material
        WHERE material_id = ?
    `;

    conn.query(sql, [materialId], (err, rows) => {
        if (err) {
            console.error('자재 수정 화면 조회 실패:', err);
            return sendMessagePage(res, '조회 실패', '수정 화면 조회 중 오류가 발생했습니다.');
        }

        if (rows.length === 0) {
            return sendMessagePage(res, '조회 실패', '해당 자재 정보가 존재하지 않습니다.');
        }

        const row = rows[0];
        const statusSelectedMap = getMaterialStatusSelectedMap(row.material_status);

        const template = readTemplate('material-edit.html');
        const html = renderTemplate(template, {
            material_id: String(row.material_id),
            material_code: escapeHtml(row.material_code),
            material_name: escapeHtml(row.material_name),
            category: escapeHtml(row.category),
            specification: escapeHtml(row.specification),
            unit: escapeHtml(row.unit),
            unit_price: String(row.unit_price),
            stock_qty: String(row.stock_qty),
            safety_stock: String(row.safety_stock),
            supplier_name: escapeHtml(row.supplier_name),
            warehouse_location: escapeHtml(row.warehouse_location),
            inbound_date: row.inbound_date,
            manager_name: escapeHtml(row.manager_name),
            manager_phone: escapeHtml(row.manager_phone),
            note: escapeHtml(row.note),
            selected_status_normal: statusSelectedMap.selected_status_normal,
            selected_status_shortage: statusSelectedMap.selected_status_shortage,
            selected_status_ordering: statusSelectedMap.selected_status_ordering,
            selected_status_discontinued: statusSelectedMap.selected_status_discontinued
        });

        res.send(html);
    });
});

app.post('/material/edit/:id', (req, res) => {
    const materialId = req.params.id;
    const {
        material_code,
        material_name,
        category,
        specification,
        unit,
        unit_price,
        stock_qty,
        safety_stock,
        supplier_name,
        warehouse_location,
        inbound_date,
        material_status,
        manager_name,
        manager_phone,
        note
    } = req.body;

    const sql = `
        UPDATE material
        SET
            material_code = ?,
            material_name = ?,
            category = ?,
            specification = ?,
            unit = ?,
            unit_price = ?,
            stock_qty = ?,
            safety_stock = ?,
            supplier_name = ?,
            warehouse_location = ?,
            inbound_date = ?,
            material_status = ?,
            manager_name = ?,
            manager_phone = ?,
            note = ?
        WHERE material_id = ?
    `;

    conn.query(sql, [
        material_code,
        material_name,
        category,
        specification,
        unit,
        unit_price,
        stock_qty,
        safety_stock,
        supplier_name,
        warehouse_location,
        inbound_date,
        material_status,
        manager_name,
        manager_phone,
        note,
        materialId
    ], (err, result) => {
        if (err) {
            console.error('자재 정보 수정 실패:', err);
            return sendMessagePage(res, '수정 실패', '자재 정보 수정 중 오류가 발생했습니다.');
        }

        if (result.affectedRows === 0) {
            return sendMessagePage(res, '수정 실패', '해당 자재 정보가 존재하지 않습니다.');
        }

        res.redirect('/material/detail/' + materialId);
    });
});

app.post('/material/delete/:id', (req, res) => {
    const materialId = req.params.id;

    const sql = `
        DELETE FROM material
        WHERE material_id = ?
    `;

    conn.query(sql, [materialId], (err, result) => {
        if (err) {
            console.error('자재 정보 삭제 실패:', err);
            return sendMessagePage(res, '삭제 실패', '자재 정보 삭제 중 오류가 발생했습니다.');
        }

        if (result.affectedRows === 0) {
            return sendMessagePage(res, '삭제 실패', '해당 자재 정보가 존재하지 않습니다.');
        }

        res.redirect('/material/list');
    });
});

app.listen(PORT, () => {
    console.log('=========================================');
    console.log(` 자재관리 서버가 포트 ${PORT}에서 작동 중입니다.`);
    console.log('=========================================');
});