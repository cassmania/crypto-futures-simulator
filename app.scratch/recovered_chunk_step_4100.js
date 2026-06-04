"            // line 전체 텍스트에서 'async function 분할차트캔들데이터로드' 가 들어있는 부분 수집
            if (line.includes('async function 분할차트캔들데이터로드') && line.includes('app.js')) {
                candidates.push({
                    step: stepIdx,
                    length: line.length,
                    raw: line
                });
            }
        } catch (e) {
            if (line.includes('async function 분할차트캔들데이터로드') && line.includes('app.js')) {
                candidates.push({
                    step: stepIdx,
                    length: line.length,
                    raw: line
                });
            }
        }"