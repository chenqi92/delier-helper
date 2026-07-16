import { invoke } from '@tauri-apps/api/core'

export async function createApiDocJob(projectPath, language, totalFiles, sourceBytes) {
    return await invoke('api_doc_create_job', {
        projectPath,
        language,
        totalFiles,
        sourceBytes,
    })
}

export async function appendApiDocModules(jobId, modules, processedFiles) {
    if (!modules?.length) return { moduleCount: 0, apiCount: 0 }
    return await invoke('api_doc_append_modules', { jobId, modules, processedFiles })
}

export async function finishApiDocJob(jobId, status = 'completed', error = null) {
    if (!jobId) return
    await invoke('api_doc_finish_job', { jobId, status, error })
}

export async function getApiDocJob(jobId) {
    return await invoke('api_doc_get_job', { jobId })
}

export async function listApiDocModules(jobId) {
    const modules = await invoke('api_doc_list_modules', { jobId })
    return modules.map(module => ({
        ...module,
        apis: [],
        _loaded: false,
    }))
}

function hydrateBody(body, schemas) {
    if (!body) return null
    const key = body.schemaId || body.type
    if (schemas.has(key)) return schemas.get(key)
    const hydrated = {
        _schemaId: body.schemaId,
        _skipAiExample: body.example !== undefined && body.example !== null,
        type: body.type,
        fields: Array.isArray(body.fields) ? body.fields : [],
    }
    if (body.example !== undefined && body.example !== null) hydrated.example = body.example
    schemas.set(key, hydrated)
    return hydrated
}

export async function queryApiDocApis(jobId, options = {}) {
    const page = await invoke('api_doc_query_apis', {
        jobId,
        moduleId: options.moduleId ?? null,
        classNames: options.classNames || [],
        limit: options.limit || 300,
        offset: options.offset || 0,
    })
    const schemas = new Map()
    return {
        ...page,
        items: page.items.map(row => ({
            _storeId: row.id,
            _moduleId: row.moduleId,
            _moduleName: row.moduleName,
            _moduleClassName: row.moduleClassName,
            _moduleBasePath: row.moduleBasePath,
            _modulePath: row.modulePath,
            _moduleFile: row.moduleFile,
            method: row.method,
            path: row.path,
            summary: row.summary,
            description: row.description,
            methodName: row.methodName,
            params: Array.isArray(row.params) ? row.params : [],
            requestBody: hydrateBody(row.requestBody, schemas),
            response: hydrateBody(row.response, schemas),
        })),
    }
}

export function groupStoredApis(items = []) {
    const groups = []
    const byId = new Map()
    for (const api of items) {
        let module = byId.get(api._moduleId)
        if (!module) {
            module = {
                id: api._moduleId,
                name: api._moduleName,
                className: api._moduleClassName,
                basePath: api._moduleBasePath,
                modulePath: api._modulePath,
                file: api._moduleFile,
                apis: [],
            }
            byId.set(api._moduleId, module)
            groups.push(module)
        }
        module.apis.push(api)
    }
    return groups
}

function serializeBody(body) {
    if (!body) return null
    return {
        type: body.type || '',
        fields: Array.isArray(body.fields) ? body.fields : [],
        example: body.example ?? null,
    }
}

export async function updateApiDocApis(jobId, apis) {
    if (!jobId || !apis?.length) return
    await invoke('api_doc_update_apis', {
        jobId,
        apis: apis.map(api => ({
            id: api._storeId,
            method: api.method || '',
            path: api.path || '',
            summary: api.summary || '',
            description: api.description || '',
            methodName: api.methodName || '',
            params: api.params || [],
            requestBody: serializeBody(api.requestBody),
            response: serializeBody(api.response),
        })),
    })
}

export async function deleteApiDocJob(jobId) {
    if (jobId) await invoke('api_doc_delete_job', { jobId })
}
