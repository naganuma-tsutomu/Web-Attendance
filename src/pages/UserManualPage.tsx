import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { BookOpen } from 'lucide-react';
import manualContent from '../../USER_MANUAL.md?raw';

const UserManualPage = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                    <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">ユーザーマニュアル</h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            システムの使い方を確認できます。
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 md:p-10 prose prose-sm sm:prose prose-slate dark:prose-invert max-w-none
                    prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-white prose-headings:scroll-mt-24
                    prose-h1:text-xl sm:prose-h1:text-2xl prose-h2:text-lg sm:prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h2:pb-2
                    prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:break-words
                    prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:rounded prose-code:px-1 prose-code:text-xs sm:prose-code:text-sm prose-code:break-words
                    prose-pre:bg-slate-100 dark:prose-pre:bg-slate-700 prose-pre:overflow-x-auto prose-pre:text-xs sm:prose-pre:text-sm
                    prose-li:marker:text-slate-400
                    prose-p:break-words
                    prose-table:text-xs sm:prose-table:text-sm prose-table:block prose-table:overflow-x-auto
                ">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        rehypePlugins={[rehypeSlug]}
                        components={{
                            a: ({ href, children, ...props }) => {
                                if (href && href.startsWith('#')) {
                                    return (
                                        <a
                                            {...props}
                                            href={href}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                // URLのデコードを試みて要素を探す（rehype-slugがエンコードしている場合）
                                                try {
                                                    const targetId = decodeURIComponent(href.substring(1));
                                                    const targetElement = document.getElementById(targetId);
                                                    if (targetElement) {
                                                        targetElement.scrollIntoView({ behavior: 'smooth' });
                                                        window.history.pushState(null, '', href);
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to scroll to target:', err);
                                                }
                                            }}
                                        >
                                            {children}
                                        </a>
                                    );
                                }
                                return <a href={href} {...props}>{children}</a>;
                            }
                        }}
                    >
                        {manualContent}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default UserManualPage;
