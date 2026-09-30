import { getDefaultState } from './index'
import { getSocket } from '@/store/runtime'
import { findDirectory } from '@/plugins/helpers'
import { MutationTree } from 'vuex'
import type { FileState, FileStateDiskUsage, FileStateFile } from '@/store/files/types'
import { allowedMetadata } from '@/store/variables'
import type { CancelTokenSource } from 'axios'

interface FileItemPayload {
    item: {
        path: string
        root: string
        permissions: string
        modified: number
        size: number
    }
}

interface FileMovePayload {
    source_item: { path: string; root: string }
    item: { path: string; root: string }
}

interface MetadataPayload {
    filename: string
    [key: string]: unknown
}

export const mutations: MutationTree<FileState> = {
    reset(state: FileState) {
        Object.assign(state, getDefaultState())
    },

    createRootDir(state: FileState, payload: { name: string; permissions: string }) {
        state.filetree.push({
            isDirectory: true,
            filename: payload.name,
            modified: new Date(),
            permissions: payload.permissions,
            childrens: [],
            disk_usage: {
                free: 0,
                total: 0,
                used: 0,
            },
        })
    },

    setMetadataRequested(state: FileState, payload: MetadataPayload) {
        let filename = 'gcodes/' + payload.filename
        const dirArray = filename.split('/')
        filename = dirArray[dirArray.length - 1]
        const path = findDirectory(state.filetree, dirArray)

        const fileIndex = path?.findIndex((element: FileStateFile) => element.filename === filename)
        if (path && fileIndex !== undefined && fileIndex !== -1) {
            const currentFile = { ...path[fileIndex] } as FileStateFile
            currentFile.metadataRequested = true

            path[fileIndex] = currentFile
        } else window.console.error('file not found in filetree: ' + payload.filename)
    },

    setMetadata(state: FileState, payload: MetadataPayload) {
        let filename = 'gcodes/' + payload.filename
        const dirArray = filename.split('/')
        filename = dirArray[dirArray.length - 1]
        const path = findDirectory(state.filetree, dirArray)

        const fileIndex = path?.findIndex((element: FileStateFile) => element.filename === filename)
        if (path && fileIndex !== undefined && fileIndex !== -1) {
            const currentFile = { ...path[fileIndex] } as FileStateFile
            allowedMetadata.forEach((key: string) => {
                if (key in payload) currentFile[key] = payload[key]
            })
            currentFile.metadataRequested = true
            currentFile.metadataPulled = true

            path[fileIndex] = currentFile
        } else window.console.error('file not found in filetree: ' + payload.filename)
    },

    setCreateFile(state: FileState, payload: FileItemPayload) {
        let filename = payload.item.path
        if (payload.item.path.lastIndexOf('/') >= 0)
            filename = payload.item.path.substr(payload.item.path.lastIndexOf('/')).replace('/', '')
        const path = payload.item.path.substr(0, payload.item.path.lastIndexOf('/'))
        const parent = findDirectory(state.filetree, (payload.item.root + '/' + path).split('/'))

        if (parent) {
            const indexFile = parent.findIndex(
                (element: FileStateFile) => !element.isDirectory && element.filename === filename
            )

            if (indexFile === -1) {
                const modified = new Date(payload.item.modified * 1000)

                parent.push({
                    isDirectory: false,
                    filename: filename,
                    modified: modified,
                    permissions: payload.item.permissions,
                    size: payload.item.size,
                    metadataRequested: false,
                    metadataPulled: false,
                })
            } else {
                parent[indexFile].modified = new Date(payload.item.modified * 1000)
                parent[indexFile].size = payload.item.size
                parent[indexFile].metadataRequested = false
                parent[indexFile].metadataPulled = false

                const extension = filename.substring(filename.lastIndexOf('.') + 1)
                if (payload.item.root === 'gcodes' && extension === 'gcode') {
                    getSocket().emit(
                        'server.files.metadata',
                        { filename: payload.item.path },
                        { action: 'files/getMetadata' }
                    )
                }
            }
        }
    },

    setMoveFile(state: FileState, payload: FileMovePayload) {
        let filenameOld = payload.source_item.path
        let pathnameOld = payload.source_item.root

        const lastSlashOld = payload.source_item.path.lastIndexOf('/')
        if (lastSlashOld !== -1) {
            filenameOld = payload.source_item.path.substring(lastSlashOld + 1)
            pathnameOld = payload.source_item.root + '/' + payload.source_item.path.substring(0, lastSlashOld)
        }

        let filenameNew = payload.item.path
        let pathnameNew = payload.item.root

        const lastSlashNew = payload.item.path.lastIndexOf('/')
        if (lastSlashNew !== -1) {
            filenameNew = payload.item.path.substring(lastSlashNew + 1)
            pathnameNew = payload.item.root + '/' + payload.item.path.substring(0, lastSlashNew)
        }

        const pathOld = findDirectory(state.filetree, pathnameOld.split('/'))
        const indexFile = pathOld?.findIndex((element: FileStateFile) => element.filename === filenameOld)

        // break if old file not found
        if (indexFile === undefined || indexFile === -1 || pathOld === null) return

        const file = pathOld.splice(indexFile, 1)[0]
        file.filename = filenameNew

        //cleanup thumbnails and force reload
        if (pathnameOld !== pathnameNew && 'metadataPulled' in file && file.metadataPulled && 'thumbnails' in file) {
            file.metadataPulled = false
            delete file.thumbnails
        }

        const newPath = findDirectory(state.filetree, pathnameNew.split('/'))
        newPath?.push(file)
    },

    setModifyFile(state: FileState, payload: FileItemPayload) {
        let filename = payload.item.path
        let filepath = payload.item.root

        const lastSlash = payload.item.path.lastIndexOf('/')
        if (lastSlash !== -1) {
            filename = payload.item.path.substr(lastSlash + 1)
            filepath = payload.item.root + '/' + payload.item.path.substr(0, lastSlash + 1)
        }

        const path = findDirectory(state.filetree, filepath.split('/'))
        const indexFile = path?.findIndex((element: FileStateFile) => element.filename === filename)

        if (indexFile !== undefined && indexFile > -1 && path && path[indexFile]) {
            if ('metadataPulled' in path[indexFile] && path[indexFile].metadataPulled) {
                path[indexFile].metadataPulled = false

                if ('thumbnails' in path[indexFile]) delete path[indexFile].thumbnails
            }

            path[indexFile].modified = new Date(payload.item.modified * 1000)
            path[indexFile].size = payload.item.size
        }
    },

    setMoveDir(state: FileState, payload: FileMovePayload) {
        let dirnameOld = payload.source_item.path
        let pathnameOld = payload.source_item.root

        const lastSlashOld = payload.source_item.path.lastIndexOf('/')
        if (lastSlashOld !== -1) {
            dirnameOld = payload.source_item.path.substr(lastSlashOld + 1)
            pathnameOld = payload.source_item.root + '/' + payload.source_item.path.substr(0, lastSlashOld + 1)
        }

        let dirnameNew = payload.item.path
        let pathnameNew = payload.item.root

        const lastSlashNew = payload.item.path.lastIndexOf('/')
        if (lastSlashNew !== -1) {
            dirnameNew = payload.item.path.substr(lastSlashNew + 1)
            pathnameNew = payload.item.root + '/' + payload.item.path.substr(0, lastSlashNew + 1)
        }

        const pathOld = findDirectory(state.filetree, pathnameOld.split('/'))
        const indexDir = pathOld?.findIndex((element: FileStateFile) => element.filename === dirnameOld)

        if (indexDir !== undefined && pathOld && pathOld[indexDir]) {
            const dir = pathOld.splice(indexDir, 1)[0]
            dir.filename = dirnameNew

            const pathNew = findDirectory(state.filetree, pathnameNew.split('/'))
            pathNew?.push(dir)
        }
    },

    setDeleteFile(state: FileState, payload: { item: { path: string; root: string } }) {
        const pathStr = payload.item.path.substr(0, payload.item.path.lastIndexOf('/'))
        const delPath = payload.item.path.substr(payload.item.path.lastIndexOf('/') + 1)
        const currentPath = findDirectory(state.filetree, (payload.item.root + '/' + pathStr).split('/'))

        if (!currentPath) return
        const index = currentPath.findIndex((element: FileStateFile) => element.filename === delPath)

        if (index >= 0 && currentPath[index]) currentPath.splice(index, 1)
    },

    setCreateDir(
        state: FileState,
        payload: { item: { path: string; root: string; permissions: string; modified?: number | Date } }
    ) {
        const dirname = payload.item.path.substr(payload.item.path.lastIndexOf('/') + 1)
        const path = payload.item.path.substr(0, payload.item.path.lastIndexOf('/'))
        const parent = findDirectory(state.filetree, (payload.item.root + '/' + path).split('/'))

        if (parent) {
            parent.push({
                isDirectory: true,
                filename: dirname,
                modified: (payload.item.modified ?? new Date()) as Date,
                permissions: payload.item.permissions,
                childrens: [],
            })
        }
    },

    setDeleteDir(state: FileState, payload: { item: { path: string; root: string } }) {
        const pathStr = payload.item.path.substr(0, payload.item.path.lastIndexOf('/'))
        const delPath = payload.item.path.substr(payload.item.path.lastIndexOf('/') + 1)
        const currentPath = findDirectory(state.filetree, (payload.item.root + '/' + pathStr).split('/'))

        if (!currentPath) return
        const index = currentPath.findIndex((element: FileStateFile) => element.filename === delPath)

        if (index >= 0 && currentPath[index]) currentPath.splice(index, 1)
    },

    setRootUpdate(state: FileState, payload: { item: { root: string } }) {
        const index = state.filetree.findIndex((root) => root.filename === payload.item.root)
        if (index !== -1 && state.filetree[index].childrens?.length) {
            state.filetree[index].childrens?.splice(0, state.filetree[index].childrens?.length)
        }
    },

    setDiskUsage(state: FileState, payload: { path: string; disk_usage: FileStateDiskUsage }) {
        const parentPath = payload.path.substr(0, payload.path.lastIndexOf('/'))
        const pathName = payload.path.substr(payload.path.lastIndexOf('/') + 1)
        const parent = findDirectory(state.filetree, parentPath.split('/'))
        const directory = parent?.find((element) => element.isDirectory && element.filename === pathName)

        if (directory) directory.disk_usage = payload.disk_usage
    },

    setRootPermissions(state: FileState, payload: { name: string; permissions: string }) {
        const rootState = state.filetree.find((dir: FileStateFile) => dir.filename === payload.name)
        if (rootState) rootState.permissions = payload.permissions
    },

    uploadClearState(state: FileState) {
        const upload = { ...state.upload }
        upload.show = false
        upload.filename = ''
        upload.cancelTokenSource = null
        upload.speed = 0
        upload.percent = 0

        state.upload = upload
    },

    uploadSetShow(state: FileState, payload: boolean) {
        state.upload.show = payload
    },

    uploadSetFilename(state: FileState, payload: string) {
        state.upload.filename = payload
    },

    uploadSetCancelTokenSource(state: FileState, payload: CancelTokenSource | null) {
        state.upload.cancelTokenSource = payload
    },

    uploadSetCurrentNumber(state: FileState, payload: number) {
        state.upload.currentNumber = payload
    },

    uploadSetMaxNumber(state: FileState, payload: number) {
        state.upload.maxNumber = payload
    },

    uploadSetPercent(state: FileState, payload: number) {
        if (state.upload.percent !== payload) state.upload.percent = payload
    },

    uploadSetSpeed(state: FileState, payload: number) {
        if (state.upload.speed !== payload) state.upload.speed = payload
    },
}
