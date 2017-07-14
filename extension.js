const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

exports.activate = (context) => {
    if (!vscode.workspace.rootPath) {
        return;
    }
    vscode.workspace.onDidChangeConfiguration(onConfigurationChanged);
    onConfigurationChanged();
};

let taskProvider;
function onConfigurationChanged() {
    const autoDetect = vscode.workspace.getConfiguration('digo').get('autoDetect');
    if (taskProvider && (autoDetect === 'off' || autoDetect === false)) {
        taskProvider.dispose();
        taskProvider = undefined;
    } else if (!taskProvider && (autoDetect == undefined || autoDetect === true || autoDetect === 'on')) {
        taskProvider = vscode.workspace.registerTaskProvider('digo', {
            provideTasks: getDigoTasks
        });
    }
}

function getDigoTasks() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(vscode.workspace.rootPath, "digofile.js"), (err, buffer) => {
            if (err) {
                reject(err);
            } else {
                const taskNames = parseDigoFile(buffer.toString("utf-8"));
                let problemMatcher = vscode.workspace.getConfiguration('digo').get('problemMatcher') || "$digo";
                if (problemMatcher == "default") problemMatcher = undefined;
                const result = [];
                const hasDefault = { __proto__: null };
                for (const taskName of taskNames) {
                    const task = new vscode.Task({
                        type: 'digo',
                        script: taskName
                    }, `${taskName}`, 'digo', appendCurrentFile(new vscode.ShellExecution(`digo ${taskName}`)), problemMatcher);
                    if (['build', 'compile', 'watch', 'publish', 'dist', 'release'].indexOf(taskName) >= 0) {
                        task.group = vscode.TaskGroup.Build;
                    } else if (['test', 'launch', 'open', 'start'].indexOf(taskName) >= 0) {
                        task.group = new vscode.TaskGroup("test", "Test");
                    } else if (['clean'].indexOf(taskName) >= 0) {
                        task.group = vscode.TaskGroup.Clean;
                    }
                    if (['watch', 'server', 'default', 'open', 'start'].indexOf(taskName) >= 0) {
                        task.isBackground = true;
                    }
                    if (['launch', 'open', 'start'].indexOf(taskName) >= 0) {
                        task.presentationOptions = {
                            focus: false,
                            reveal: vscode.TaskRevealKind.Silent
                        };
                    }
                    result.push(task);
                }
                resolve(result);
            }
        });
    });
}

function appendCurrentFile(task) {
    let commandLine = task.commandLine;
    return Object.defineProperty(task, "commandLine", {
        get() {
            const file = getCurrentFile();
            if (file) {
                return `${commandLine} "${file}"`;
            }
            return commandLine;
        },
        set(value) {
            commandLine = value;
        }
    });
}

function parseDigoFile(content) {
    const result = [];
    content.replace(/exports\.(\w+)\s*=/g, (all, word) => {
        result.push(word);
    });
    return result;
}

function getCurrentFile() {
    if (vscode.window.activeTextEditor) {
        return vscode.window.activeTextEditor.document.fileName;
    }
}
