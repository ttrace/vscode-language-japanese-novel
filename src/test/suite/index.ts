import * as path from 'path';
import Mocha from 'mocha';
import {glob} from 'glob';

export function run(): Promise<void> {
    // Create the mocha test

    const mocha = new Mocha({
        ui: 'tdd'
    });

    const testsRoot = path.resolve(__dirname, '../../../test');

    return new Promise((c, e) => {
        //glob('**/**.test.js', { cwd: testsRoot });
    });
}
