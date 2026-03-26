import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Views } from 'react-big-calendar';
import ScheduleHeader from '../ScheduleHeader';

describe('ScheduleHeader Component', () => {
    it('renders the current date correctly', () => {
        const currentDate = new Date('2025-05-15');
        render(
            <ScheduleHeader
                currentDate={currentDate}
                view={Views.MONTH}
                generating={false}
                errorCount={0}
                loadError={null}
                isSummaryOpen={false}
                targetYearMonth="2025-05"
                staffList={[]}
                rawShifts={[]}
                classes={[]}
                timePatterns={[]}
                preferences={[]}
                holidays={[]}
                onDateChange={vi.fn()}
                onViewChange={vi.fn()}
                onGenerate={vi.fn()}
                onClearShifts={vi.fn()}
                onToggleSummary={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('2025年5月')).toBeInTheDocument();
    });

    it('shows error banner when errorCount > 0', () => {
        const currentDate = new Date('2025-05-15');
        render(
            <ScheduleHeader
                currentDate={currentDate}
                view={Views.MONTH}
                generating={false}
                errorCount={3}
                loadError={null}
                isSummaryOpen={false}
                targetYearMonth="2025-05"
                staffList={[]}
                rawShifts={[]}
                classes={[]}
                timePatterns={[]}
                preferences={[]}
                holidays={[]}
                onDateChange={vi.fn()}
                onViewChange={vi.fn()}
                onGenerate={vi.fn()}
                onClearShifts={vi.fn()}
                onToggleSummary={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('シフトエラーがあります (3件)')).toBeInTheDocument();
    });

    it('triggers onGenerate when Generate button is clicked', () => {
        const currentDate = new Date('2025-05-15');
        const mockOnGenerate = vi.fn();

        render(
            <ScheduleHeader
                currentDate={currentDate}
                view={Views.MONTH}
                generating={false}
                errorCount={0}
                loadError={null}
                isSummaryOpen={false}
                targetYearMonth="2025-05"
                staffList={[]}
                rawShifts={[]}
                classes={[]}
                timePatterns={[]}
                preferences={[]}
                holidays={[]}
                onDateChange={vi.fn()}
                onViewChange={vi.fn()}
                onGenerate={mockOnGenerate}
                onClearShifts={vi.fn()}
                onToggleSummary={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        const generateBtn = screen.getByText('自動生成');
        fireEvent.click(generateBtn);
        expect(mockOnGenerate).toHaveBeenCalled();
    });

    it('shows generating state', () => {
        const currentDate = new Date('2025-05-15');
        render(
            <ScheduleHeader
                currentDate={currentDate}
                view={Views.MONTH}
                generating={true}
                errorCount={0}
                loadError={null}
                isSummaryOpen={false}
                targetYearMonth="2025-05"
                staffList={[]}
                rawShifts={[]}
                classes={[]}
                timePatterns={[]}
                preferences={[]}
                holidays={[]}
                onDateChange={vi.fn()}
                onViewChange={vi.fn()}
                onGenerate={vi.fn()}
                onClearShifts={vi.fn()}
                onToggleSummary={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('生成中...')).toBeInTheDocument();
        const generateBtn = screen.getByText('生成中...').closest('button');
        expect(generateBtn).toBeDisabled();
    });

    it('shows disabled PDF button', () => {
        const currentDate = new Date('2025-05-15');
        render(
            <ScheduleHeader
                currentDate={currentDate}
                view={Views.MONTH}
                generating={false}
                errorCount={0}
                loadError={null}
                isSummaryOpen={false}
                targetYearMonth="2025-05"
                staffList={[]}
                rawShifts={[]}
                classes={[]}
                timePatterns={[]}
                preferences={[]}
                holidays={[]}
                onDateChange={vi.fn()}
                onViewChange={vi.fn()}
                onGenerate={vi.fn()}
                onClearShifts={vi.fn()}
                onToggleSummary={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        const pdfBtn = screen.getByText('PDF (準備中)').closest('button');
        expect(pdfBtn).toBeDisabled();
    });
});
