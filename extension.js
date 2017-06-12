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
                for (const taskName of taskNames) {
                    const task = new vscode.Task({
                        type: 'digo',
                        script: taskName
                    }, `${taskName}`, 'digo', new vscode.ShellExecution(`digo ${taskName}`), problemMatcher);
                    if (['build', 'compile', 'watch', 'publish', 'dist', 'release'].indexOf(taskName)) {
                        task.group = vscode.TaskGroup.Build;
                    } else if (['test', 'lauch'].indexOf(taskName)) {
                        task.group = vscode.TaskGroup.Test;
                    } else if (['clean'].indexOf(taskName)) {
                        task.group = vscode.TaskGroup.Clean;
                    }
                    result.push(task);
                }
                resolve(result);
            }
        });
    });
}

function parseDigoFile(content) {
    const result = [];
    content.replace(/exports\.(\w+)\s*=/g, (all, word) => {
        result.push(word);
    });
    return result;
}
