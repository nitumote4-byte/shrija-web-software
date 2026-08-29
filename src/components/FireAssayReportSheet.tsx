import {
  FIRE_ASSAY_SHEET_FORMAT,
  formatFireAssayReportDate,
} from '../data/fireAssayViewLayout'

export type FireAssayReportRow = {
  key: string
  sampleDrawn: string
  jobCardNo: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
  locked?: boolean
}

type Props = {
  rows: FireAssayReportRow[]
  purity: string
  delta1: string
  delta2: string
  avgDelta: string
  weighingDate: string
  reportingDate: string
  weightedBy: string
  reportedBy: string
}

/**
 * Format F-25 Fire Assay Sheet. This is the single print/PDF markup:
 * native browser Print Preview and Save as PDF both render this element.
 */
export function FireAssayReportSheet({
  rows,
  purity,
  delta1,
  delta2,
  avgDelta,
  weighingDate,
  reportingDate,
  weightedBy,
  reportedBy,
}: Props) {
  const fmt = FIRE_ASSAY_SHEET_FORMAT
  const weigh = formatFireAssayReportDate(weighingDate)
  const report = formatFireAssayReportDate(reportingDate)

  return (
    <article className="fa-report-sheet" aria-label="Fire Assay Sheet">
      <table className="fa-report-head">
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={2}>
              FORMAT NO: <strong>{fmt.formatNo}</strong>
            </td>
            <td colSpan={2}>
              FORMAT Issue No. <strong>{fmt.issueNo}</strong>
            </td>
            <td colSpan={2}>
              Revision No. <strong>{fmt.revisionNo}</strong>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              Prepared by: <strong>{fmt.preparedBy}</strong>
            </td>
            <td colSpan={2}>
              Approved by: <strong>{fmt.approvedBy}</strong>
            </td>
            <td colSpan={2}>
              Issued by: <strong>{fmt.issuedBy}</strong>
            </td>
          </tr>
          <tr>
            <td colSpan={6}>
              Issue Date: <strong>{fmt.issueDate}</strong>
            </td>
          </tr>
          <tr>
            <th colSpan={6} className="fa-report-title">
              Fire Assay Sheet
            </th>
          </tr>
          <tr>
            <td colSpan={3}>
              Date (Weighing): <strong>{weigh}</strong>
            </td>
            <td colSpan={3}>
              Date (Reporting): <strong>{report}</strong>
            </td>
          </tr>
          <tr>
            <td colSpan={3}>
              Weighted by: <strong>{weightedBy}</strong>
            </td>
            <td colSpan={3}>
              Reported by: <strong>{reportedBy}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="fa-report-metrics">
        <thead>
          <tr>
            <th>Purity</th>
            <th>Delta 1</th>
            <th>Delta 2</th>
            <th>Average Delta In Mg</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{purity}</td>
            <td>{delta1}</td>
            <td>{delta2}</td>
            <td>{avgDelta}</td>
          </tr>
        </tbody>
      </table>

      <table className="fa-report-data">
        <colgroup>
          <col className="fa-col-drawn" />
          <col className="fa-col-job" />
          <col className="fa-col-sw" />
          <col className="fa-col-ag" />
          <col className="fa-col-pb" />
          <col className="fa-col-cornet" />
          <col className="fa-col-fin" />
          <col className="fa-col-mean" />
        </colgroup>
        <thead>
          <tr>
            <th>
              Sample Drawn /
              <br />
              Button Wt
            </th>
            <th>Job Card No</th>
            <th>Sample Weight</th>
            <th>Silver</th>
            <th>Lead</th>
            <th>
              Wt. of Gold
              <br />
              Cornet After Assay
            </th>
            <th>Fineness</th>
            <th>Mean Fineness</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.locked ? 'fa-report-cg' : undefined}>
              <td>{row.sampleDrawn}</td>
              <td>{row.jobCardNo}</td>
              <td>{row.sampleWeight}</td>
              <td>{row.silver}</td>
              <td>{row.lead}</td>
              <td>{row.wotgcaa}</td>
              <td>{row.fineness}</td>
              <td>{row.meanFineness}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}
