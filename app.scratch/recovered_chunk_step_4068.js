"            // line 전체 텍스트에서 'function 모의매매상태복원' 이 들어있는 부분 수집
            if (line.includes('function 모의매매상태복원') && line.includes('app.js')) {
                candidates.push({
                    step: stepIdx,
                    length: line.length,
                    raw: line
                });
            }
        } catch (e) {
            if (line.includes('function 모의매매상태복원') && line.includes('app.js')) {
                candidates.push({
                    step: stepIdx,
                    length: line.length,
                    raw: line
                });
            }
        }"