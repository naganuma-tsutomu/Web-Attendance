import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { History } from 'lucide-react';
import historyContent from '../../docs/UPDATE_HISTORY.md?raw';

const UpdateHistoryPage = () => (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 md:p-8">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                <History className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">更新履歴</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        バージョンごとの機能追加と変更内容を確認できます。
                    </p>
                </div>
            </div>

            <div className="w-full !max-w-none bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 md:p-10 prose prose-sm sm:prose prose-slate dark:prose-invert
                prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-white
                prose-h1:text-xl sm:prose-h1:text-2xl prose-h2:text-lg sm:prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h2:pb-2
                prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:rounded prose-code:px-1
                prose-li:marker:text-slate-400 prose-p:break-words
            ">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ children, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer">
                                {children}
                            </a>
                        ),
                    }}
                >
                    {historyContent}
                </ReactMarkdown>
            </div>
        </div>
    </div>
);

export default UpdateHistoryPage;
