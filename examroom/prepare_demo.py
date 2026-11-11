"""Build the FE bank from the verbatim transcription. Never paraphrase exam text."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def prepare():
    original = json.loads((ROOT / 'data' / 'fe-original.json').read_text(encoding='utf-8'))
    source = (ROOT.parent / 'SSG105_FE_225597_Dap_an.md').read_text(encoding='utf-8')
    answers = {m[1]: (m[2], m[3]) for m in re.finditer(
        r'^\| (\d+) \| \*\*([A-E])\..*?\*\* \| (.*?) \|$', source, re.M)}
    questions = []
    for row in original['questions']:
        files = list((ROOT.parent / 'FE').glob(row['photoId'] + '_*.jpg'))
        if len(files) != 1:
            raise ValueError('Expected exactly one original image for question ' + row['id'])
        answer, explanation = answers[row['id']]
        questions.append(dict(id=row['id'], text=row['text'], options=row['options'],
            answer=answer, explanation=explanation, image='/assets/fe/' + files[0].name,
            note='Đáp án tham khảo theo “Why (sometimes)” trong slide; câu hỏi có cách diễn đạt chưa chặt chẽ.' if row['id'] == '22' else ''))
    bank = dict(version=1, sourceId=original['sourceId'], contentRevision=original['contentRevision'],
        title='SSG105 · Final Exam', subject='SSG105', durationMinutes=30,
        description='Đề SU26 · 225597 · 30 câu nguyên văn từ ảnh gốc. Đáp án tham khảo và giải thích riêng.',
        questions=questions)
    (ROOT / 'web' / 'demo.json').write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding='utf-8')
    return bank

if __name__ == '__main__':
    prepare()
