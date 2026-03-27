import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';
import manualContent from '../../USER_MANUAL.md?raw';

const UserManualPage = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-3 mb-6">
                    <BookOpen className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">ユーザーマニュアル</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            システムの使い方を確認できます。
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-10 prose prose-slate dark:prose-invert max-w-none
                    prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-white
                    prose-h1:text-2xl prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h2:pb-2
                    prose-a:text-indigo-600 dark:prose-a:text-indigo-400
                    prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:rounded prose-code:px-1
                    prose-pre:bg-slate-100 dark:prose-pre:bg-slate-700
                    prose-li:marker:text-slate-400
                ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{manualContent}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default UserManualPage;
