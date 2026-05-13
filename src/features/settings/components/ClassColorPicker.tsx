import { CLASS_COLORS } from './classColors';

const ClassColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex flex-wrap gap-2">
        {CLASS_COLORS.map(c => (
            <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={`色 ${c} を選択`}
                className={`w-7 h-7 rounded-full transition-all ${value === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
            />
        ))}
    </div>
);

export default ClassColorPicker;
