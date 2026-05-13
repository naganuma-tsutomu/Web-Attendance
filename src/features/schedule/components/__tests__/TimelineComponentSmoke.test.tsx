import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TimelineFixedToggle, TimelineHeaderRows } from '../TimelineHeaderRows';

describe('timeline component smoke tests', () => {
    it('renders editable timeline headers with duty number column', () => {
        render(
            <TimelineHeaderRows
                readOnly={false}
                showDutyNumbers={true}
                hourLabels={[9, 10, 11]}
                displayStartMins={9 * 60}
                displayTotalMins={2 * 60}
            />
        );

        expect(screen.getByText('№')).toBeInTheDocument();
        expect(screen.getByText('名前')).toBeInTheDocument();
        expect(screen.getByText('シフトパターン')).toBeInTheDocument();
        expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('renders read-only timeline headers', () => {
        render(
            <TimelineHeaderRows
                readOnly={true}
                showDutyNumbers={false}
                hourLabels={[9, 10]}
                displayStartMins={9 * 60}
                displayTotalMins={60}
            />
        );

        expect(screen.getByText('名前')).toBeInTheDocument();
        expect(screen.getByText(/時間/)).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('renders fixed toggle and routes clicks', () => {
        const onToggleFixed = vi.fn();

        render(<TimelineFixedToggle isFixed={false} onToggleFixed={onToggleFixed} />);

        fireEvent.click(screen.getByText('シフトをロックする'));
        expect(onToggleFixed).toHaveBeenCalled();
    });
});
