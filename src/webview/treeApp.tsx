import React, { useEffect, useState } from 'react';
import { useDrop } from 'react-dnd';
import { ItemTypes } from './treeItemTypes';

export const App: React.FC = () => {
    const [files, setFiles] = useState<string[]>([]);

    useEffect(() => {
        // VS Codeから送信されるメッセージを受け取る
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'update') {
                setFiles(message.files);
            }
        });
    }, []);

    const [, dropRef] = useDrop({
        accept: ItemTypes.FILE,
        drop(item) {
            console.log(`Dropped item: ${item}`);
        },
    });

    return (
        <div ref={dropRef}>
            {files.map(file => (
                <div key={file}>{file}</div>
            ))}
        </div>
    );
};

export default App;
