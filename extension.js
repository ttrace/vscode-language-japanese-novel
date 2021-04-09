function activate(context) {
    console.log('hello, world');
}

function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };