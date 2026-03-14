/**
 * 注册页面 JavaScript
 * 使用 utils.js 中的工具库
 */

// 状态
let currentTask = null;
let currentBatch = null;
let logPollingInterval = null;
let batchPollingInterval = null;
let isBatchMode = false;
let availableServices = {
    tempmail: { available: true, services: [] },
    outlook: { available: false, services: [] },
    custom_domain: { available: false, services: [] }
};

// DOM 元素
const elements = {
    form: document.getElementById('registration-form'),
    emailService: document.getElementById('email-service'),
    proxy: document.getElementById('proxy'),
    regMode: document.getElementById('reg-mode'),
    batchCountGroup: document.getElementById('batch-count-group'),
    batchCount: document.getElementById('batch-count'),
    batchOptions: document.getElementById('batch-options'),
    intervalMin: document.getElementById('interval-min'),
    intervalMax: document.getElementById('interval-max'),
    startBtn: document.getElementById('start-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    taskStatusCard: document.getElementById('task-status-card'),
    batchStatusCard: document.getElementById('batch-status-card'),
    consoleLog: document.getElementById('console-log'),
    clearLogBtn: document.getElementById('clear-log-btn'),
    // 任务状态
    taskId: document.getElementById('task-id'),
    taskEmail: document.getElementById('task-email'),
    taskStatus: document.getElementById('task-status'),
    taskService: document.getElementById('task-service'),
    taskStatusBadge: document.getElementById('task-status-badge'),
    // 批量状态
    batchProgress: document.getElementById('batch-progress'),
    progressBar: document.getElementById('progress-bar'),
    batchSuccess: document.getElementById('batch-success'),
    batchFailed: document.getElementById('batch-failed'),
    batchRemaining: document.getElementById('batch-remaining')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadSavedProxy();
    loadAvailableServices();
});

// 事件监听
function initEventListeners() {
    // 注册表单提交
    elements.form.addEventListener('submit', handleStartRegistration);

    // 注册模式切换
    elements.regMode.addEventListener('change', handleModeChange);

    // 邮箱服务切换
    elements.emailService.addEventListener('change', handleServiceChange);

    // 取消按钮
    elements.cancelBtn.addEventListener('click', handleCancelTask);

    // 清空日志
    elements.clearLogBtn.addEventListener('click', () => {
        elements.consoleLog.innerHTML = '<div class="log-line info">[系统] 日志已清空</div>';
    });
}

// 加载保存的代理设置
async function loadSavedProxy() {
    try {
        const settings = await api.get('/settings');
        if (settings.proxy?.host) {
            elements.proxy.value = `${settings.proxy.type}://${settings.proxy.host}:${settings.proxy.port}`;
        }
    } catch (error) {
        // 忽略错误
    }
}

// 加载可用的邮箱服务
async function loadAvailableServices() {
    try {
        const data = await api.get('/registration/available-services');
        availableServices = data;

        // 更新邮箱服务选择框
        updateEmailServiceOptions();

        addLog('info', '[系统] 邮箱服务列表已加载');
    } catch (error) {
        console.error('加载邮箱服务列表失败:', error);
        addLog('warning', '[警告] 加载邮箱服务列表失败');
    }
}

// 更新邮箱服务选择框
function updateEmailServiceOptions() {
    const select = elements.emailService;
    select.innerHTML = '';

    // Tempmail
    if (availableServices.tempmail.available) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '🌐 临时邮箱';

        availableServices.tempmail.services.forEach(service => {
            const option = document.createElement('option');
            option.value = `tempmail:${service.id || 'default'}`;
            option.textContent = service.name;
            option.dataset.type = 'tempmail';
            optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
    }

    // Outlook
    if (availableServices.outlook.available) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `📧 Outlook (${availableServices.outlook.count} 个账户)`;

        availableServices.outlook.services.forEach(service => {
            const option = document.createElement('option');
            option.value = `outlook:${service.id}`;
            option.textContent = service.name + (service.has_oauth ? ' (OAuth)' : '');
            option.dataset.type = 'outlook';
            option.dataset.serviceId = service.id;
            optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
    } else {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '📧 Outlook (未配置)';

        const option = document.createElement('option');
        option.value = '';
        option.textContent = '请先在设置中导入账户';
        option.disabled = true;
        optgroup.appendChild(option);

        select.appendChild(optgroup);
    }

    // 自定义域名
    if (availableServices.custom_domain.available) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `🔗 自定义域名 (${availableServices.custom_domain.count} 个服务)`;

        availableServices.custom_domain.services.forEach(service => {
            const option = document.createElement('option');
            option.value = `custom_domain:${service.id || 'default'}`;
            option.textContent = service.name;
            option.dataset.type = 'custom_domain';
            if (service.id) {
                option.dataset.serviceId = service.id;
            }
            optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
    } else {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '🔗 自定义域名 (未配置)';

        const option = document.createElement('option');
        option.value = '';
        option.textContent = '请先在设置中添加服务';
        option.disabled = true;
        optgroup.appendChild(option);

        select.appendChild(optgroup);
    }
}

// 处理邮箱服务切换
function handleServiceChange(e) {
    const value = e.target.value;
    if (!value) return;

    const [type, id] = value.split(':');
    const selectedOption = e.target.options[e.target.selectedIndex];

    // 显示服务信息
    if (type === 'outlook') {
        const service = availableServices.outlook.services.find(s => s.id == id);
        if (service) {
            addLog('info', `[系统] 已选择 Outlook 账户: ${service.name}`);
        }
    } else if (type === 'custom_domain') {
        const service = availableServices.custom_domain.services.find(s => s.id == id);
        if (service) {
            addLog('info', `[系统] 已选择自定义域名服务: ${service.name}`);
        }
    }
}

// 模式切换
function handleModeChange(e) {
    const mode = e.target.value;
    isBatchMode = mode === 'batch';

    elements.batchCountGroup.style.display = isBatchMode ? 'block' : 'none';
    elements.batchOptions.style.display = isBatchMode ? 'block' : 'none';
}

// 开始注册
async function handleStartRegistration(e) {
    e.preventDefault();

    const selectedValue = elements.emailService.value;
    if (!selectedValue) {
        toast.error('请选择一个邮箱服务');
        return;
    }

    const [emailServiceType, serviceId] = selectedValue.split(':');
    const proxy = elements.proxy.value.trim() || null;

    // 禁用开始按钮
    elements.startBtn.disabled = true;
    elements.cancelBtn.disabled = false;

    // 清空日志
    elements.consoleLog.innerHTML = '';

    // 构建请求数据
    const requestData = {
        email_service_type: emailServiceType,
        proxy: proxy
    };

    // 如果选择了数据库中的服务，传递 service_id
    if (serviceId && serviceId !== 'default') {
        requestData.email_service_id = parseInt(serviceId);
    }

    if (isBatchMode) {
        await handleBatchRegistration(requestData);
    } else {
        await handleSingleRegistration(requestData);
    }
}

// 单次注册
async function handleSingleRegistration(requestData) {
    addLog('info', '[系统] 正在启动注册任务...');

    try {
        const data = await api.post('/registration/start', requestData);

        currentTask = data;
        addLog('info', `[系统] 任务已创建: ${data.task_uuid}`);
        showTaskStatus(data);
        updateTaskStatus('running');

        // 开始轮询日志
        startLogPolling(data.task_uuid);

    } catch (error) {
        addLog('error', `[错误] 启动失败: ${error.message}`);
        toast.error(error.message);
        resetButtons();
    }
}

// 批量注册
async function handleBatchRegistration(requestData) {
    const count = parseInt(elements.batchCount.value) || 5;
    const intervalMin = parseInt(elements.intervalMin.value) || 5;
    const intervalMax = parseInt(elements.intervalMax.value) || 30;

    requestData.count = count;
    requestData.interval_min = intervalMin;
    requestData.interval_max = intervalMax;

    addLog('info', `[系统] 正在启动批量注册任务 (数量: ${count})...`);

    try {
        const data = await api.post('/registration/batch', requestData);

        currentBatch = data;
        addLog('info', `[系统] 批量任务已创建: ${data.batch_id}`);
        addLog('info', `[系统] 共 ${data.count} 个任务已加入队列`);
        showBatchStatus(data);

        // 开始轮询批量状态
        startBatchPolling(data.batch_id);

    } catch (error) {
        addLog('error', `[错误] 启动失败: ${error.message}`);
        toast.error(error.message);
        resetButtons();
    }
}

// 取消任务
async function handleCancelTask() {
    if (isBatchMode && currentBatch) {
        try {
            await api.post(`/registration/batch/${currentBatch.batch_id}/cancel`);
            addLog('warning', '[警告] 批量任务取消请求已提交');
            toast.info('任务取消请求已提交');
            stopBatchPolling();
            resetButtons();
        } catch (error) {
            addLog('error', `[错误] 取消失败: ${error.message}`);
            toast.error(error.message);
        }
    } else if (currentTask) {
        try {
            await api.post(`/registration/tasks/${currentTask.task_uuid}/cancel`);
            addLog('warning', '[警告] 任务已取消');
            toast.info('任务已取消');
            stopLogPolling();
            resetButtons();
        } catch (error) {
            addLog('error', `[错误] 取消失败: ${error.message}`);
            toast.error(error.message);
        }
    }
}

// 开始轮询日志
function startLogPolling(taskUuid) {
    let lastLogIndex = 0;

    logPollingInterval = setInterval(async () => {
        try {
            const data = await api.get(`/registration/tasks/${taskUuid}/logs`);

            // 更新任务状态
            updateTaskStatus(data.status);

            // 更新邮箱信息
            if (data.email) {
                elements.taskEmail.textContent = data.email;
            }
            if (data.email_service) {
                elements.taskService.textContent = getServiceTypeText(data.email_service);
            }

            // 添加新日志
            const logs = data.logs || [];
            for (let i = lastLogIndex; i < logs.length; i++) {
                const log = logs[i];
                const logType = getLogType(log);
                addLog(logType, log);
            }
            lastLogIndex = logs.length;

            // 检查任务是否完成
            if (['completed', 'failed', 'cancelled'].includes(data.status)) {
                stopLogPolling();
                resetButtons();

                if (data.status === 'completed') {
                    addLog('success', '[成功] 注册成功！');
                    toast.success('注册成功！');
                } else if (data.status === 'failed') {
                    addLog('error', '[错误] 注册失败');
                    toast.error('注册失败');
                } else if (data.status === 'cancelled') {
                    addLog('warning', '[警告] 任务已取消');
                }
            }
        } catch (error) {
            console.error('轮询日志失败:', error);
        }
    }, 1000);
}

// 停止轮询日志
function stopLogPolling() {
    if (logPollingInterval) {
        clearInterval(logPollingInterval);
        logPollingInterval = null;
    }
}

// 开始轮询批量状态
function startBatchPolling(batchId) {
    batchPollingInterval = setInterval(async () => {
        try {
            const data = await api.get(`/registration/batch/${batchId}`);
            updateBatchProgress(data);

            // 检查是否完成
            if (data.finished) {
                stopBatchPolling();
                resetButtons();

                addLog('info', `[完成] 批量任务完成！成功: ${data.success}, 失败: ${data.failed}`);
                if (data.success > 0) {
                    toast.success(`批量注册完成，成功 ${data.success} 个`);
                } else {
                    toast.warning('批量注册完成，但没有成功注册任何账号');
                }
            }
        } catch (error) {
            console.error('轮询批量状态失败:', error);
        }
    }, 2000);
}

// 停止轮询批量状态
function stopBatchPolling() {
    if (batchPollingInterval) {
        clearInterval(batchPollingInterval);
        batchPollingInterval = null;
    }
}

// 显示任务状态
function showTaskStatus(task) {
    elements.taskStatusCard.style.display = 'block';
    elements.batchStatusCard.style.display = 'none';
    elements.taskId.textContent = task.task_uuid;
    elements.taskEmail.textContent = '-';
    elements.taskService.textContent = '-';
}

// 更新任务状态
function updateTaskStatus(status) {
    const statusInfo = {
        pending: { text: '等待中', class: 'pending' },
        running: { text: '运行中', class: 'running' },
        completed: { text: '已完成', class: 'completed' },
        failed: { text: '失败', class: 'failed' },
        cancelled: { text: '已取消', class: 'disabled' }
    };

    const info = statusInfo[status] || { text: status, class: '' };
    elements.taskStatusBadge.textContent = info.text;
    elements.taskStatusBadge.className = `status-badge ${info.class}`;
    elements.taskStatus.textContent = info.text;
}

// 显示批量状态
function showBatchStatus(batch) {
    elements.batchStatusCard.style.display = 'block';
    elements.taskStatusCard.style.display = 'none';
    elements.batchProgress.textContent = `0/${batch.count}`;
    elements.progressBar.style.width = '0%';
    elements.batchSuccess.textContent = '0';
    elements.batchFailed.textContent = '0';
    elements.batchRemaining.textContent = batch.count;

    // 重置计数器
    elements.batchSuccess.dataset.last = '0';
    elements.batchFailed.dataset.last = '0';
}

// 更新批量进度
function updateBatchProgress(data) {
    const progress = (data.completed / data.total * 100).toFixed(0);
    elements.batchProgress.textContent = data.progress || `${data.completed}/${data.total}`;
    elements.progressBar.style.width = `${progress}%`;
    elements.batchSuccess.textContent = data.success;
    elements.batchFailed.textContent = data.failed;
    elements.batchRemaining.textContent = data.total - data.completed;

    // 记录日志（避免重复）
    if (data.completed > 0) {
        const lastSuccess = parseInt(elements.batchSuccess.dataset.last || '0');
        const lastFailed = parseInt(elements.batchFailed.dataset.last || '0');

        if (data.success > lastSuccess) {
            addLog('success', `[成功] 第 ${data.success} 个账号注册成功`);
        }
        if (data.failed > lastFailed) {
            addLog('error', `[失败] 第 ${data.failed} 个账号注册失败`);
        }

        elements.batchSuccess.dataset.last = data.success;
        elements.batchFailed.dataset.last = data.failed;
    }
}

// 添加日志
function addLog(type, message) {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;

    // 添加时间戳
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    line.innerHTML = `<span class="timestamp">[${timestamp}]</span>${escapeHtml(message)}`;
    elements.consoleLog.appendChild(line);

    // 自动滚动到底部
    elements.consoleLog.scrollTop = elements.consoleLog.scrollHeight;

    // 限制日志行数
    const lines = elements.consoleLog.querySelectorAll('.log-line');
    if (lines.length > 500) {
        lines[0].remove();
    }
}

// 获取日志类型
function getLogType(log) {
    if (typeof log !== 'string') return 'info';

    const lowerLog = log.toLowerCase();
    if (lowerLog.includes('error') || lowerLog.includes('失败') || lowerLog.includes('错误')) {
        return 'error';
    }
    if (lowerLog.includes('warning') || lowerLog.includes('警告')) {
        return 'warning';
    }
    if (lowerLog.includes('success') || lowerLog.includes('成功') || lowerLog.includes('完成')) {
        return 'success';
    }
    return 'info';
}

// 重置按钮状态
function resetButtons() {
    elements.startBtn.disabled = false;
    elements.cancelBtn.disabled = true;
    currentTask = null;
    currentBatch = null;
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
